import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createDb, type Db } from '../src/infrastructure/db/pool.js'
import { createAuditsRepository } from '../src/infrastructure/db/audits-repository.js'
import { testEnv } from './helpers.js'

const enabled =
  process.env.RUN_SUPABASE_INTEGRATION === '1' && Boolean(process.env.DATABASE_URL)

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 })

describe.skipIf(!enabled)('Phase 5B Audits PostgreSQL real integration', () => {
  let db: Db
  let repo: ReturnType<typeof createAuditsRepository>
  let actor: string
  let aliasId: string
  let supervisorId: string
  const marker = `P5B-${Date.now()}`
  const createdPlanningIds: string[] = []
  const createdAuditIds: string[] = []
  const createdActionIds: string[] = []
  const createdPlantillaIds: string[] = []
  const idempotencyKeys: string[] = []
  let originalActiveId: string | null = null

  beforeAll(async () => {
    db = createDb(testEnv({ DATABASE_URL: process.env.DATABASE_URL! }))
    repo = createAuditsRepository(db)

    const refs = (
      await db.query(
        `select
           (select id from public.perfiles order by id limit 1) as actor,
           (select id from public.cliente_domicilios order by id limit 1) as alias_id,
           (select id from public.perfiles order by id limit 1) as supervisor_id,
           (select id from public.auditoria_checklist_plantillas where activa = true limit 1) as active_id`,
      )
    ).rows[0]

    actor = String(refs.actor)
    aliasId = String(refs.alias_id)
    supervisorId = String(refs.supervisor_id)
    originalActiveId = refs.active_id ? String(refs.active_id) : null

    expect([actor, aliasId, supervisorId].every(x => x && x !== 'null')).toBe(true)

    // Additive migration must already provide plantilla updated_at + idempotency ops.
    const schema = (
      await db.query<{
        plantilla_updated_at: boolean
        idempotency: boolean
      }>(
        `select
           exists(
             select 1 from information_schema.columns
             where table_schema = 'public'
               and table_name = 'auditoria_checklist_plantillas'
               and column_name = 'updated_at'
           ) as plantilla_updated_at,
           to_regclass('public.audits_operation_idempotency') is not null as idempotency`,
      )
    ).rows[0]
    expect(schema.plantilla_updated_at).toBe(true)
    expect(schema.idempotency).toBe(true)
  })

  afterAll(async () => {
    if (!db) return
    try {
      if (createdActionIds.length) {
        await db.query('delete from public.auditoria_plan_accion where id = any($1::uuid[])', [
          createdActionIds,
        ])
      }
      if (createdAuditIds.length) {
        await db.query('delete from public.auditoria_respuestas where auditoria_id = any($1::uuid[])', [
          createdAuditIds,
        ])
        await db.query('delete from public.auditorias where id = any($1::uuid[])', [createdAuditIds])
      }
      if (createdPlanningIds.length) {
        await db.query('delete from public.auditoria_planificaciones where id = any($1::uuid[])', [
          createdPlanningIds,
        ])
      }
      if (createdPlantillaIds.length) {
        await db.query('delete from public.auditoria_checklist_items where plantilla_id = any($1::uuid[])', [
          createdPlantillaIds,
        ])
        await db.query('delete from public.auditoria_checklist_plantillas where id = any($1::uuid[])', [
          createdPlantillaIds,
        ])
      }
      if (idempotencyKeys.length) {
        await db.query(
          `delete from public.audits_operation_idempotency
           where actor_id = $1 and idempotency_key = any($2::text[])`,
          [actor, idempotencyKeys],
        )
      }
      if (originalActiveId) {
        await db.query(
          `update public.auditoria_checklist_plantillas set activa = true where id = $1`,
          [originalActiveId],
        )
      }
    } finally {
      await db.close()
    }
  })

  async function ensureActiveTemplate() {
    const active = await repo.checklistActive().catch(() => null)
    if (active) return active as { id: string; items: Array<{ id: string }>; updated_at: string }

    const created = (await repo.checklistCreate({
      codigoFormulario: `${marker}-FR`,
      version: 'V1',
      vigenciaDesde: '2026-01-01',
      items: [
        { orden: 1, texto: `${marker} item 1` },
        { orden: 2, texto: `${marker} item 2` },
      ],
    })) as { id: string; updated_at: string }
    createdPlantillaIds.push(created.id)
    const activated = (await repo.checklistActivate(created.id, created.updated_at)) as {
      id: string
      updated_at: string
    }
    return repo.checklistDetail(activated.id) as Promise<{
      id: string
      items: Array<{ id: string }>
      updated_at: string
    }>
  }

  it('rolls back submit when answer insert fails after audit header insert', async () => {
    const template = await ensureActiveTemplate()
    const before = Number(
      (await db.query('select count(*)::text as count from public.auditorias')).rows[0].count,
    )
    const key = `${marker}-submit-rollback`
    idempotencyKeys.push(key)

    await expect(
      repo.submit(
        {
          planificacionId: null,
          aliasId,
          plantillaId: template.id,
          fechaRealizada: '2026-09-30',
          supervisorId,
          evaluacionGeneral: null,
          proximaSupervisionFecha: null,
          quejasComentariosCliente: null,
          otros: null,
          respuestas: template.items.map((item, index) => ({
            itemId: item.id,
            resultado: 'conforme' as const,
            observaciones: index === 0 ? 'bad\u0000observation' : null,
          })),
        },
        actor,
        key,
      ),
    ).rejects.toBeTruthy()

    const after = Number(
      (await db.query('select count(*)::text as count from public.auditorias')).rows[0].count,
    )
    expect(after).toBe(before)
  })

  it('replays sequential and concurrent submit idempotency', async () => {
    const template = await ensureActiveTemplate()
    const payload = {
      planificacionId: null as string | null,
      aliasId,
      plantillaId: template.id,
      fechaRealizada: '2026-09-30',
      supervisorId,
      evaluacionGeneral: marker,
      proximaSupervisionFecha: null as string | null,
      quejasComentariosCliente: null as string | null,
      otros: null as string | null,
      respuestas: template.items.map(item => ({
        itemId: item.id,
        resultado: 'conforme' as const,
        observaciones: null as string | null,
      })),
    }

    const sequentialKey = `${marker}-submit-seq`
    idempotencyKeys.push(sequentialKey)
    const first = await repo.submit(payload, actor, sequentialKey)
    createdAuditIds.push(String((first.response as { id: string }).id))
    const second = await repo.submit(payload, actor, sequentialKey)
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect((second.response as { id: string }).id).toBe((first.response as { id: string }).id)

    const concurrentKey = `${marker}-submit-concurrent`
    idempotencyKeys.push(concurrentKey)
    const concurrentPayload = {
      ...payload,
      evaluacionGeneral: `${marker}-concurrent`,
      fechaRealizada: '2026-09-29',
    }
    const [a, b] = await Promise.all([
      repo.submit(concurrentPayload, actor, concurrentKey),
      repo.submit(concurrentPayload, actor, concurrentKey),
    ])
    expect([a.replayed, b.replayed].sort()).toEqual([false, true])
    const winner = a.replayed ? b : a
    createdAuditIds.push(String((winner.response as { id: string }).id))

    await expect(repo.submit({ ...concurrentPayload, evaluacionGeneral: 'other' }, actor, concurrentKey)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('enforces planning optimistic concurrency and cancel races', async () => {
    const created = (await repo.createPlanning({
      aliasId,
      fechaPropuesta: '2026-10-15',
      horarioDesde: null,
      horarioHasta: null,
      supervisorId,
      observaciones: marker,
    })) as { id: string; updated_at: string }
    createdPlanningIds.push(created.id)

    const updated = (await repo.updatePlanning(created.id, {
      aliasId,
      fechaPropuesta: '2026-10-16',
      horarioDesde: '09:00',
      horarioHasta: '10:00',
      supervisorId,
      observaciones: `${marker}-updated`,
      updatedAt: created.updated_at,
    })) as { id: string; updated_at: string }

    await expect(
      repo.updatePlanning(created.id, {
        aliasId,
        fechaPropuesta: '2026-10-17',
        horarioDesde: null,
        horarioHasta: null,
        supervisorId,
        observaciones: 'stale',
        updatedAt: created.updated_at,
      }),
    ).rejects.toMatchObject({ status: 409 })

    await expect(repo.cancelPlanning(created.id, created.updated_at)).rejects.toMatchObject({
      status: 409,
    })

    const cancelled = (await repo.cancelPlanning(created.id, updated.updated_at)) as {
      estado: string
      updated_at: string
    }
    expect(cancelled.estado).toBe('cancelada')

    await expect(repo.cancelPlanning(created.id, cancelled.updated_at)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('rejects invalid answers and cross-audit action integrity', async () => {
    const template = await ensureActiveTemplate()
    const key = `${marker}-invalid-answers`
    idempotencyKeys.push(key)

    await expect(
      repo.submit(
        {
          planificacionId: null,
          aliasId,
          plantillaId: template.id,
          fechaRealizada: '2026-09-28',
          supervisorId,
          evaluacionGeneral: null,
          proximaSupervisionFecha: null,
          quejasComentariosCliente: null,
          otros: null,
          respuestas: [
            {
              itemId: template.items[0]!.id,
              resultado: 'conforme',
              observaciones: null,
            },
          ],
        },
        actor,
        key,
      ),
    ).rejects.toMatchObject({ status: 409 })

    const okKey = `${marker}-action-integrity`
    idempotencyKeys.push(okKey)
    const submitted = await repo.submit(
      {
        planificacionId: null,
        aliasId,
        plantillaId: template.id,
        fechaRealizada: '2026-09-28',
        supervisorId,
        evaluacionGeneral: null,
        proximaSupervisionFecha: null,
        quejasComentariosCliente: null,
        otros: null,
        respuestas: template.items.map((item, index) => ({
          itemId: item.id,
          resultado: index === 0 ? ('no_conforme' as const) : ('conforme' as const),
          observaciones: index === 0 ? 'NC' : null,
        })),
      },
      actor,
      okKey,
    )
    const auditId = String((submitted.response as { id: string }).id)
    createdAuditIds.push(auditId)

    const otherKey = `${marker}-other-audit`
    idempotencyKeys.push(otherKey)
    const other = await repo.submit(
      {
        planificacionId: null,
        aliasId,
        plantillaId: template.id,
        fechaRealizada: '2026-09-27',
        supervisorId,
        evaluacionGeneral: null,
        proximaSupervisionFecha: null,
        quejasComentariosCliente: null,
        otros: null,
        respuestas: template.items.map(item => ({
          itemId: item.id,
          resultado: 'conforme' as const,
          observaciones: null,
        })),
      },
      actor,
      otherKey,
    )
    const otherAuditId = String((other.response as { id: string }).id)
    createdAuditIds.push(otherAuditId)

    const otherAnswerId = String(
      (
        await db.query(
          `select id from public.auditoria_respuestas where auditoria_id = $1 limit 1`,
          [otherAuditId],
        )
      ).rows[0].id,
    )

    await expect(
      repo.createAction(auditId, {
        respuestaId: otherAnswerId,
        descripcion: 'cross',
        responsableId: null,
        fechaLimite: null,
      }),
    ).rejects.toMatchObject({ status: 409 })

    const action = (await repo.createAction(auditId, {
      respuestaId: null,
      descripcion: `${marker} action`,
      responsableId: supervisorId,
      fechaLimite: '2026-09-01',
      })) as { id: string; updated_at: string }
    createdActionIds.push(action.id)

    const updated = (await repo.updateAction(action.id, {
      updatedAt: action.updated_at,
      estado: 'en_curso',
      descripcion: `${marker} action updated`,
    })) as { updated_at: string; estado: string }
    expect(updated.estado).toBe('en_curso')

    await expect(
      repo.updateAction(action.id, {
        updatedAt: action.updated_at,
        estado: 'resuelto',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('rejects historic checklist edits and supports copy/edit/activate flows', async () => {
    const source = (await repo.checklistCreate({
      codigoFormulario: `${marker}-COPY`,
      version: 'V1',
      vigenciaDesde: '2026-01-01',
      items: [
        { orden: 1, texto: `${marker} A` },
        { orden: 2, texto: `${marker} B` },
      ],
    })) as { id: string; updated_at: string }
    createdPlantillaIds.push(source.id)

    const activated = (await repo.checklistActivate(source.id, source.updated_at)) as {
      id: string
      updated_at: string
    }

    const detail = await repo.checklistDetail(activated.id)
    const submitKey = `${marker}-historic-submit`
    idempotencyKeys.push(submitKey)
    const submitted = await repo.submit(
      {
        planificacionId: null,
        aliasId,
        plantillaId: activated.id,
        fechaRealizada: '2026-09-26',
        supervisorId,
        evaluacionGeneral: null,
        proximaSupervisionFecha: null,
        quejasComentariosCliente: null,
        otros: null,
        respuestas: (detail as { items: Array<{ id: string }> }).items.map(item => ({
          itemId: item.id,
          resultado: 'conforme' as const,
          observaciones: null,
        })),
      },
      actor,
      submitKey,
    )
    createdAuditIds.push(String((submitted.response as { id: string }).id))

    const afterSubmit = await repo.checklistDetail(activated.id)
    await expect(
      repo.checklistUpdate(activated.id, {
        updatedAt: (afterSubmit as { updated_at: string }).updated_at,
        items: [{ orden: 1, texto: 'changed' }],
      }),
    ).rejects.toMatchObject({ status: 409 })

    const copyKey = `${marker}-copy`
    idempotencyKeys.push(copyKey)
    const copied = await repo.checklistCopy(
      activated.id,
      { version: 'V2', vigenciaDesde: '2026-03-01' },
      actor,
      copyKey,
    )
    expect(copied.replayed).toBe(false)
    const copyId = String((copied.response as { id: string }).id)
    createdPlantillaIds.push(copyId)

    const replay = await repo.checklistCopy(
      activated.id,
      { version: 'V2', vigenciaDesde: '2026-03-01' },
      actor,
      copyKey,
    )
    expect(replay.replayed).toBe(true)
    expect((replay.response as { id: string }).id).toBe(copyId)

    await expect(
      repo.checklistCopy(
        activated.id,
        { version: 'V2b', vigenciaDesde: '2026-03-01' },
        actor,
        copyKey,
      ),
    ).rejects.toMatchObject({ status: 409 })

    const copyDetail = (await repo.checklistDetail(copyId)) as {
      updated_at: string
      items: Array<{ id: string; orden: number; texto: string }>
      activa: boolean
    }
    expect(copyDetail.activa).toBe(false)
    expect(copyDetail.items).toHaveLength(2)

    const edited = (await repo.checklistUpdate(copyId, {
      updatedAt: copyDetail.updated_at,
      items: [
        { id: copyDetail.items[0]!.id, orden: 1, texto: `${marker} A2` },
        { orden: 2, texto: `${marker} C` },
      ],
    })) as { id: string; updated_at: string; items: Array<{ texto: string }> }
    expect(edited.items.map(i => i.texto)).toEqual([`${marker} A2`, `${marker} C`])

    const other = (await repo.checklistCreate({
      codigoFormulario: `${marker}-ACT`,
      version: 'X',
      vigenciaDesde: '2026-04-01',
      items: [{ orden: 1, texto: `${marker} only` }],
    })) as { id: string; updated_at: string }
    createdPlantillaIds.push(other.id)

    const [actA, actB] = await Promise.allSettled([
      repo.checklistActivate(copyId, edited.updated_at),
      repo.checklistActivate(other.id, other.updated_at),
    ])
    expect([actA.status, actB.status].includes('fulfilled')).toBe(true)

    const activeCount = Number(
      (
        await db.query(
          `select count(*)::text as count from public.auditoria_checklist_plantillas where activa = true`,
        )
      ).rows[0].count,
    )
    expect(activeCount).toBe(1)
  })
})
