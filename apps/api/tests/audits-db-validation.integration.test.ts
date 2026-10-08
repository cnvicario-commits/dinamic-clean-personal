import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const additivePath = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/forward/20260930130000_phase5b_audits_api.sql',
)
const closurePath = resolve(
  import.meta.dirname,
  '../../../supabase/migrations/forward/20260930131500_phase5b_audits_runtime_grants.sql',
)

describe('Phase 5B audits migration contract', () => {
  const additive = readFileSync(additivePath, 'utf8')
  const closure = readFileSync(closurePath, 'utf8')

  it('additive migration requires shared set_updated_at and adds plantilla updated_at trigger', () => {
    expect(additive).toMatch(/to_regprocedure\('public\.set_updated_at\(\)'\)/)
    expect(additive).toMatch(/auditoria_checklist_plantillas[\s\S]*add column if not exists updated_at/i)
    expect(additive).toMatch(/trg_auditoria_checklist_plantillas_updated_at/)
    expect(additive).toMatch(/execute function public\.set_updated_at\(\)/)
  })

  it('additive migration widens idempotency and grants dinamic_api without browser DML revoke', () => {
    expect(additive).toMatch(/audit_submit/)
    expect(additive).toMatch(/audit_checklist_copy/)
    expect(additive).toMatch(/drop constraint/i)
    expect(additive).toMatch(/grant select, insert, update, delete on public\.%I to dinamic_api/)
    expect(additive).toMatch(/_dinamic_api_all/)
    expect(additive).not.toMatch(/revoke insert,\s*update,\s*delete on public\.%I from anon, authenticated/i)
    expect(additive).not.toMatch(/_authenticated_all/)
    expect(additive).not.toMatch(/_authenticated_select/)
  })

  it('closure migration revokes browser DML and creates explicit authenticated SELECT policies', () => {
    expect(closure).toMatch(/revoke insert,\s*update,\s*delete on public\.%I from anon, authenticated/i)
    expect(closure).not.toMatch(/revoke select on public\.%I from anon, authenticated/i)
    expect(closure).toMatch(/_authenticated_select/)
    expect(closure).toMatch(/for select to authenticated using \(true\)/)
    expect(closure).toMatch(/_dinamic_api_all/)
    expect(closure).toMatch(/grant select, insert, update, delete[\s\S]*dinamic_api/)
  })

  it('does not add UNIQUE plantilla_id/orden or auditoria_id/item_id constraints', () => {
    expect(additive).not.toMatch(/unique\s*\(\s*plantilla_id\s*,\s*orden\s*\)/i)
    expect(additive).not.toMatch(/unique\s*\(\s*auditoria_id\s*,\s*item_id\s*\)/i)
    expect(closure).not.toMatch(/unique\s*\(\s*plantilla_id\s*,\s*orden\s*\)/i)
    expect(closure).not.toMatch(/unique\s*\(\s*auditoria_id\s*,\s*item_id\s*\)/i)
  })
})
