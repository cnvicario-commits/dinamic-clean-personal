import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(import.meta.dirname, '../../../supabase/migrations/forward/20261005143000_main_sync_perfiles_rol_ventas.sql'),
  'utf8',
)

const EXPECTED_ROLES = ['admin', 'gerente', 'compras', 'supervisor', 'auditoria', 'ventas'] as const

describe('main-sync perfiles_rol_check forward migration (SQL contract)', () => {
  it('extends the check constraint without dropping prior roles', () => {
    expect(sql).toMatch(/perfiles_rol_check/i)
    for (const role of EXPECTED_ROLES) {
      expect(sql).toContain(`'${role}'`)
    }
    expect(sql).not.toContain("'ventas'::text,'admin'") // sanity: ventas is additive
  })

  it('uses transactional DDL', () => {
    expect(sql).toMatch(/begin;/i)
    expect(sql).toMatch(/commit;/i)
  })
})
