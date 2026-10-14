import { afterAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { createCrmRepository } from '../src/infrastructure/db/crm-repository.js'
import { withCrmCalendarDates } from '../src/infrastructure/db/crm/crm-dates.js'
import { createDb, type Db } from '../src/infrastructure/db/pool.js'
import type { CrmScope } from '../src/domain/crm-scope.js'
import { crmUpdateOpportunity } from '../src/http/schemas/crm.js'
import { testEnv } from './helpers.js'

const OPP = '77777777-7777-4777-8777-777777777777'
const PROSPECT = '55555555-5555-4555-8555-555555555555'
const ACTOR = '22222222-2222-4222-8222-222222222222'
const scope: CrmScope = { userId: ACTOR, global: true }
const SAME = new Date('2026-10-14T21:39:00.123Z')
const SAME_ISO = SAME.toISOString()
const OTHER_ISO = '2026-10-14T21:39:00.124Z'

type Row = {
  estado: string
  updated_at: Date | string
  comentarios: string | null
  fecha_envio: string | null
  fecha_facturacion: string | null
}

function opportunityDb(updatedAt: Date | string) {
  const row: Row = {
    estado: 'en_seguimiento',
    updated_at: updatedAt,
    comentarios: 'viejo',
    fecha_envio: null,
    fecha_facturacion: null,
  }
  const query = async (sql: string, params: unknown[] = []) => {
    const text = sql.replace(/\s+/g, ' ').trim().toLowerCase()
    if (text === 'begin' || text === 'commit' || text === 'rollback') return { rows: [] }
    if (text.startsWith('select prospecto_id,updated_at from public.crm_oportunidades')) {
      return { rows: [{ prospecto_id: PROSPECT, updated_at: row.updated_at }] }
    }
    if (text.startsWith('select estado,updated_at from public.crm_oportunidades')) {
      return { rows: [{ estado: row.estado, updated_at: row.updated_at }] }
    }
    if (text.startsWith('update public.crm_oportunidades set estado=')) {
      row.estado = String(params[1])
      return { rows: [] }
    }
    if (text.startsWith('update public.crm_oportunidades set')) {
      row.fecha_envio = params[1] == null ? null : String(params[1])
      row.fecha_facturacion = params[2] == null ? null : String(params[2])
      row.comentarios = params[3] == null ? null : String(params[3])
      return { rows: [] }
    }
    if (text.startsWith('insert into public.crm_seguimientos')) {
      return { rows: [{ id: 'follow-up' }] }
    }
    if (text.startsWith('select o.*')) {
      return { rows: [{ id: params[0], ...row }] }
    }
    throw new Error(`unexpected sql: ${text}`)
  }
  const client = { query, release() {} }
  const db = { pool: { connect: async () => client }, query } as unknown as Db
  return { repo: createCrmRepository(db), row }
}

describe('CRM opportunity version and date columns', () => {
  const db = createDb(testEnv())
  afterAll(() => db.close())

  it('accepts the same instant when pg returns a Date and the client sends its ISO string', async () => {
    const updated = opportunityDb(SAME)
    const result = await updated.repo.updateOpportunity(
      OPP,
      {
        updatedAt: SAME_ISO,
        fechaEnvio: '2026-08-30',
        fechaFacturacion: '2026-09-01',
        comentarios: 'nuevo',
      },
      scope,
    )
    expect(updated.row.comentarios).toBe('nuevo')
    expect(updated.row.fecha_envio).toBe('2026-08-30')
    expect(updated.row.fecha_facturacion).toBe('2026-09-01')
    expect(result).toMatchObject({ id: OPP, comentarios: 'nuevo' })

    const moved = opportunityDb(SAME)
    const transitioned = await moved.repo.transition(OPP, { estado: 'aceptado', updatedAt: SAME_ISO }, ACTOR, scope)
    expect(moved.row.estado).toBe('aceptado')
    expect(transitioned).toMatchObject({ id: OPP, estado: 'aceptado' })
  })

  it('still rejects a different instant on update and transition', async () => {
    const updated = opportunityDb(SAME)
    await expect(
      updated.repo.updateOpportunity(OPP, { updatedAt: OTHER_ISO, comentarios: 'nuevo' }, scope),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Opportunity was modified by another user',
    })
    expect(updated.row.comentarios).toBe('viejo')

    const moved = opportunityDb(SAME)
    await expect(
      moved.repo.transition(OPP, { estado: 'aceptado', updatedAt: OTHER_ISO }, ACTOR, scope),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Opportunity was modified by another user',
    })
    expect(moved.row.estado).toBe('en_seguimiento')
  })

  it('parses date columns as YYYY-MM-DD only for a CRM checkout and leaves the global parser unchanged', async () => {
    expect(pg.types.getTypeParser(pg.types.builtins.DATE)('2026-08-30')).toBeInstanceOf(Date)
    expect(pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ)('2026-10-14 21:39:00.123+00')).toBeInstanceOf(Date)

    const types = new pg.TypeOverrides()
    let released = false
    const client = {
      getTypeParser: (oid: number, format?: 'text' | 'binary') => types.getTypeParser(oid, format),
      setTypeParser: (
        oid: number,
        format: 'text' | 'binary' | ((value: string) => unknown),
        parseFn?: (value: string) => unknown,
      ) => {
        if (typeof format === 'function') types.setTypeParser(oid, format)
        else types.setTypeParser(oid, format, parseFn!)
      },
      async query() {
        return {
          rows: [{
            fecha_envio: types.getTypeParser(pg.types.builtins.DATE)('2026-08-30'),
            fecha_facturacion: types.getTypeParser(pg.types.builtins.DATE)('2026-09-01'),
            updated_at: pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ)('2026-10-14 21:39:00.123+00'),
          }],
        }
      },
      release() {
        released = true
      },
    }
    const crm = withCrmCalendarDates({
      pool: { connect: async () => client },
    } as unknown as Db)
    const row = (await crm.query(
      `select '2026-08-30'::date as fecha_envio, '2026-09-01'::date as fecha_facturacion, timestamptz '2026-10-14 21:39:00.123+00' as updated_at`,
    )).rows[0] as { fecha_envio: string; fecha_facturacion: string; updated_at: Date }

    expect(row.fecha_envio).toBe('2026-08-30')
    expect(row.fecha_facturacion).toBe('2026-09-01')
    expect(row.updated_at).toBeInstanceOf(Date)
    expect(released).toBe(true)
    expect(types.getTypeParser(pg.types.builtins.DATE)('2026-08-30')).toBeInstanceOf(Date)
    expect(pg.types.getTypeParser(pg.types.builtins.DATE)('2026-08-30')).toBeInstanceOf(Date)

    const apiRow = JSON.parse(JSON.stringify(row)) as {
      fecha_envio: string
      fecha_facturacion: string
      updated_at: string
    }
    expect(apiRow.fecha_envio).toBe('2026-08-30')
    expect(apiRow.fecha_facturacion).toBe('2026-09-01')
    expect(crmUpdateOpportunity.safeParse({
      updatedAt: apiRow.updated_at,
      fechaEnvio: apiRow.fecha_envio,
      fechaFacturacion: apiRow.fecha_facturacion,
      comentarios: 'nuevo',
    }).success).toBe(true)
  })
})
