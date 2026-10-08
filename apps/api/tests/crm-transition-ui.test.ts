import { describe, expect, it } from 'vitest'
import { reconcileCrmTransition } from '../../../src/utils/crm-transition.ts'

describe('CRM board transition reconciliation', () => {
  it('uses the returned V2 as the next transition precondition', () => {
    const v1 = { id: '33333333-3333-4333-8333-333333333333', estado: 'en_seguimiento', updated_at: '2026-09-30T12:00:00.000Z', crm_prospectos: { nombre: 'Prospecto' } }
    const responseV2 = { id: v1.id, estado: 'aceptado', updated_at: '2026-09-30T12:00:01.000Z', fecha_cierre: '2026-09-30' }

    const afterFirst = reconcileCrmTransition(v1, responseV2)
    expect(afterFirst.updated_at).toBe(responseV2.updated_at)
    expect(afterFirst.estado).toBe('aceptado')
    expect(afterFirst.crm_prospectos).toEqual(v1.crm_prospectos)

    const responseV3 = { id: v1.id, estado: 'en_espera', updated_at: '2026-09-30T12:00:02.000Z' }
    const afterSecond = reconcileCrmTransition(afterFirst, responseV3)
    expect(afterSecond.updated_at).toBe(responseV3.updated_at)
  })
})
