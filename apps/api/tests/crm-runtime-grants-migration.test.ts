import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(import.meta.dirname, '../../../supabase/migrations/forward/20260930121500_phase5a_crm_runtime_grants.sql'),
  'utf8',
)

describe('Phase 5A CRM runtime grants corrective migration', () => {
  it('grants the API role and gives its idempotency table an RLS policy', () => {
    expect(sql).toMatch(/grant usage on schema public to dinamic_api/i)
    expect(sql).toMatch(/grant select, insert, update, delete[\s\S]*crm_operation_idempotency[\s\S]*dinamic_api/i)
    expect(sql).toContain('crm_operation_idempotency_dinamic_api_all')
    for (const table of [
      'crm_prospectos',
      'crm_oportunidades',
      'crm_seguimientos',
      'crm_referidores',
      'crm_tipos_cliente',
      'crm_tipos_servicio',
      'crm_vistas',
    ]) {
      expect(sql).toContain(`'${table}'`)
    }
  })
})
