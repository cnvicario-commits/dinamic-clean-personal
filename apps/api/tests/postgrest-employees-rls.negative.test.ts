import { describe, it } from 'vitest'

/**
 * Phase 3A browser-DML closure proof. The migration preserves SELECT for Phase 3B
 * consumers but revokes INSERT/UPDATE from authenticated and anon.
 * Never point this opt-in test at production.
 */
const postgrestNegativeReady = Boolean(
  process.env.RUN_SUPABASE_INTEGRATION === '1'
    && process.env.SUPABASE_URL
    && process.env.SUPABASE_ANON_KEY
    && process.env.POSTGREST_TEST_USER_JWT,
)

describe.skipIf(!postgrestNegativeReady)('Phase 3A PostgREST browser DML negative', () => {
  it.each([
    ['POST', 'empleados', { nombre_apellido: 'DENY TEST', cuil: 'deny-test', horas_contrato: 8, empresa: 'DINAMIC' }],
    ['PATCH', 'empleados?id=eq.00000000-0000-0000-0000-000000000000', { activo: false }],
    ['POST', 'asignaciones', { empleado_id: '00000000-0000-0000-0000-000000000000', cliente_id: '00000000-0000-0000-0000-000000000000', fecha_desde: '2026-01-01' }],
    ['PATCH', 'asignaciones?id=eq.00000000-0000-0000-0000-000000000000', { fecha_hasta: '2026-01-01' }],
  ])('browser %s %s is denied', async (method, resource, body) => {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${resource}`, {
      method,
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY!,
        authorization: `Bearer ${process.env.POSTGREST_TEST_USER_JWT}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    })
    expect(response.ok).toBe(false)
    expect([401, 403]).toContain(response.status)
  })
})
