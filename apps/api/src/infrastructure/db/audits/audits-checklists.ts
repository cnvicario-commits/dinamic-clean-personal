import type { Db } from '../pool.js'
import { conflict, notFound } from '../../../http/errors/app-error.js'
import type { ChecklistCopy, ChecklistCreate, ChecklistUpdate } from '../../../http/schemas/audits.js'
import {
  assertUnchanged,
  type AuditClient,
  auditOne as one,
  auditPayloadHash as hash,
  auditTx as tx,
  beginAuditIdempotency as beginIdempotency,
  completeAuditIdempotency as completeIdempotency,
} from './audits-shared.js'

export function createAuditsChecklistsMethods(db: Db) {
  const listChecklists = async () => {
    const rows = await db.query(
      `select id, codigo_formulario, version, vigencia_desde, activa, created_at, updated_at
       from public.auditoria_checklist_plantillas
       order by vigencia_desde desc, created_at desc, id`,
    )
    return rows.rows
  }

  const checklistDetail = async (id: string) => {
    const plantilla = one(
      (
        await db.query(
          `select id, codigo_formulario, version, vigencia_desde, activa, created_at, updated_at
           from public.auditoria_checklist_plantillas
           where id = $1`,
          [id],
        )
      ).rows,
      'Checklist template not found',
    )
    const items = await db.query(
      `select id, plantilla_id, orden, texto, created_at
       from public.auditoria_checklist_items
       where plantilla_id = $1
       order by orden asc, id`,
      [id],
    )
    return { ...plantilla, items: items.rows }
  }

  const checklistActive = async () => {
    const plantilla = (
      await db.query(
        `select id, codigo_formulario, version, vigencia_desde, activa, created_at, updated_at
         from public.auditoria_checklist_plantillas
         where activa = true
         limit 1`,
      )
    ).rows[0]
    if (!plantilla) throw notFound('No active checklist template')
    const items = await db.query(
      `select id, plantilla_id, orden, texto, created_at
       from public.auditoria_checklist_items
       where plantilla_id = $1
       order by orden asc, id`,
      [(plantilla as { id: string }).id],
    )
    return { ...plantilla, items: items.rows }
  }

  const checklistCreate = (v: ChecklistCreate) =>
    tx(db, async c => {
      const plantilla = one(
        (
          await c.query(
            `insert into public.auditoria_checklist_plantillas
              (codigo_formulario, version, vigencia_desde, activa)
             values ($1, $2, $3, false)
             returning *`,
            [v.codigoFormulario, v.version, v.vigenciaDesde],
          )
        ).rows,
        'Checklist creation failed',
      )
      await c.query(
        `insert into public.auditoria_checklist_items (plantilla_id, orden, texto)
         select $1, x.orden, x.texto
         from jsonb_to_recordset($2::jsonb) as x(orden int, texto text)`,
        [(plantilla as { id: string }).id, JSON.stringify(v.items)],
      )
      return plantilla
    })

  const checklistUpdate = (id: string, v: ChecklistUpdate) =>
    tx(db, async c => {
      const plantilla = one(
        (
          await c.query<{ updated_at: string | null }>(
            `select updated_at
             from public.auditoria_checklist_plantillas
             where id = $1
             for update`,
            [id],
          )
        ).rows,
        'Checklist template not found',
      )
      assertUnchanged(plantilla.updated_at, v.updatedAt, 'Checklist template was modified by another user')

      const used = await c.query<{ exists: boolean }>(
        `select exists(
           select 1 from public.auditorias where plantilla_id = $1
         ) as exists`,
        [id],
      )
      if (used.rows[0]?.exists) {
        throw conflict('Checklist template is historical and cannot be edited')
      }

      const existing = (
        await c.query<{ id: string }>(
          'select id from public.auditoria_checklist_items where plantilla_id = $1 for update',
          [id],
        )
      ).rows.map(row => row.id)

      const keepIds = v.items.filter(item => item.id).map(item => item.id!)
      for (const itemId of keepIds) {
        if (!existing.includes(itemId)) {
          throw conflict('Checklist item does not belong to this template')
        }
      }

      const removeIds = existing.filter(itemId => !keepIds.includes(itemId))
      if (removeIds.length) {
        await c.query(
          'delete from public.auditoria_checklist_items where plantilla_id = $1 and id = any($2::uuid[])',
          [id, removeIds],
        )
      }

      for (const item of v.items) {
        if (item.id) {
          await c.query(
            `update public.auditoria_checklist_items
             set orden = $2, texto = $3
             where id = $1 and plantilla_id = $4`,
            [item.id, item.orden, item.texto, id],
          )
        } else {
          await c.query(
            `insert into public.auditoria_checklist_items (plantilla_id, orden, texto)
             values ($1, $2, $3)`,
            [id, item.orden, item.texto],
          )
        }
      }

      // Touch plantilla so updated_at advances via trigger even if only items changed.
      await c.query(
        `update public.auditoria_checklist_plantillas
         set version = version
         where id = $1`,
        [id],
      )

      return checklistDetailWithClient(c, id)
    })

  const checklistDetailWithClient = async (c: AuditClient, id: string) => {
    const plantilla = one(
      (
        await c.query<{
          id: string
          codigo_formulario: string
          version: number
          vigencia_desde: string
          activa: boolean
          created_at: string
          updated_at: string
        }>(
          `select id, codigo_formulario, version, vigencia_desde, activa, created_at, updated_at
           from public.auditoria_checklist_plantillas
           where id = $1`,
          [id],
        )
      ).rows,
      'Checklist template not found',
    )
    const items = await c.query(
      `select id, plantilla_id, orden, texto, created_at
       from public.auditoria_checklist_items
       where plantilla_id = $1
       order by orden asc, id`,
      [id],
    )
    return { ...plantilla, items: items.rows }
  }

  const checklistCopy = (id: string, v: ChecklistCopy, actor: string, key: string) =>
    tx(db, async c => {
      const payloadHash = hash({ sourceId: id, ...v })
      const idem = await beginIdempotency(c, actor, 'audit_checklist_copy', key, payloadHash)
      if (idem.replayed) return { replayed: true, response: idem.response }

      const source = one(
        (
          await c.query<{ codigo_formulario: string }>(
            `select codigo_formulario
             from public.auditoria_checklist_plantillas
             where id = $1
             for update`,
            [id],
          )
        ).rows,
        'Checklist template not found',
      )

      const plantilla = one(
        (
          await c.query(
            `insert into public.auditoria_checklist_plantillas
              (codigo_formulario, version, vigencia_desde, activa)
             values ($1, $2, $3, false)
             returning *`,
            [source.codigo_formulario, v.version, v.vigenciaDesde],
          )
        ).rows,
        'Checklist copy failed',
      )

      await c.query(
        `insert into public.auditoria_checklist_items (plantilla_id, orden, texto)
         select $1, orden, texto
         from public.auditoria_checklist_items
         where plantilla_id = $2
         order by orden, id`,
        [(plantilla as { id: string }).id, id],
      )

      const detail = await checklistDetailWithClient(c, (plantilla as { id: string }).id)
      await completeIdempotency(c, actor, 'audit_checklist_copy', key, detail)
      return { replayed: false, response: detail }
    })

  const checklistActivate = (id: string, updatedAt: string) =>
    tx(db, async c => {
      const old = one(
        (
          await c.query<{ updated_at: string | null }>(
            `select updated_at
             from public.auditoria_checklist_plantillas
             where id = $1
             for update`,
            [id],
          )
        ).rows,
        'Checklist template not found',
      )
      assertUnchanged(old.updated_at, updatedAt, 'Checklist template was modified by another user')

      // Serialize against concurrent activations and clear the previous active
      // row before setting this one, so the partial UNIQUE index does not race
      // with the AFTER trigger.
      await c.query(
        `select id
         from public.auditoria_checklist_plantillas
         where activa
         for update`,
      )
      await c.query(
        `update public.auditoria_checklist_plantillas
         set activa = false
         where activa and id <> $1`,
        [id],
      )

      return one(
        (
          await c.query(
            `update public.auditoria_checklist_plantillas
             set activa = true
             where id = $1
             returning *`,
            [id],
          )
        ).rows,
        'Checklist template not found',
      )
    })

  return {
    listChecklists,
    checklistDetail,
    checklistActive,
    checklistCreate,
    checklistUpdate,
    checklistCopy,
    checklistActivate,
  }
}
