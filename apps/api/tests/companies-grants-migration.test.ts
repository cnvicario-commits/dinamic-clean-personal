import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(import.meta.dirname, '../../../supabase/migrations/forward/20261030140000_empresas_api_write_grants.sql'),
  'utf8',
)

describe('empresas API write grants', () => {
  it('lets dinamic_api insert and update, and removes browser write grants', () => {
    expect(sql).toMatch(/grant select, insert, update on table public\.empresas to dinamic_api/i)
    expect(sql).toContain('empresas_dinamic_api_insert')
    expect(sql).toContain('empresas_dinamic_api_update')
    for (const privilege of ['insert', 'update', 'delete', 'truncate', 'references', 'trigger']) {
      expect(sql.toLowerCase()).toContain(privilege)
    }
    expect(sql).toMatch(/revoke insert, update, delete, truncate, references, trigger on table public\.empresas from anon/i)
    expect(sql).toMatch(/revoke insert, update, delete, truncate, references, trigger on table public\.empresas from authenticated/i)
    expect(sql).toMatch(/revoke select on table public\.empresas from anon/i)
    expect(sql).not.toMatch(/revoke select on table public\.empresas from authenticated/i)
  })
})
