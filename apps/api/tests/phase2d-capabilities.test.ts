import { describe, expect, it } from 'vitest'
import { probePhase2dProfilesCapabilities } from '../src/infrastructure/db/phase2d-capabilities.js'

describe('probePhase2dProfilesCapabilities', () => {
  it('ok when role, privileges, RLS, and policies match', async () => {
    const responses: Record<string, unknown[]> = {
      current_user: [{ current_user: 'dinamic_api' }],
      attrs: [{ rolsuper: false, rolbypassrls: false }],
      priv: [
        {
          has_select: true,
          has_delete: false,
          col_insert_id: true,
          col_insert_nombre: true,
          col_insert_rol: true,
          col_update_nombre: true,
          col_update_rol: true,
          col_update_id: false,
          col_update_created: false,
        },
      ],
      rls: [{ relrowsecurity: true }],
      policies: [
        { polname: 'perfiles_dinamic_api_select' },
        { polname: 'perfiles_dinamic_api_insert' },
        { polname: 'perfiles_dinamic_api_update' },
        { polname: 'perfiles_select_authenticated' },
      ],
    }
    let step = 0
    const order = ['current_user', 'attrs', 'priv', 'rls', 'policies'] as const
    const result = await probePhase2dProfilesCapabilities(async () => {
      const key = order[step++]
      return { rows: (responses[key!] ?? []) as Record<string, unknown>[] }
    })
    expect(result).toEqual({ ok: true })
  })

  it('fails when INSERT privilege missing', async () => {
    let step = 0
    const result = await probePhase2dProfilesCapabilities(async () => {
      step += 1
      if (step === 1) return { rows: [{ current_user: 'dinamic_api' }] }
      if (step === 2) return { rows: [{ rolsuper: false, rolbypassrls: false }] }
      return {
        rows: [
          {
            has_select: true,
            has_delete: false,
            col_insert_id: false,
            col_insert_nombre: false,
            col_insert_rol: false,
            col_update_nombre: true,
            col_update_rol: true,
            col_update_id: false,
            col_update_created: false,
          },
        ],
      }
    })
    expect(result).toEqual({ ok: false, reason: 'missing_insert_privilege' })
  })

  it('fails when BYPASSRLS', async () => {
    let step = 0
    const result = await probePhase2dProfilesCapabilities(async () => {
      step += 1
      if (step === 1) return { rows: [{ current_user: 'dinamic_api' }] }
      return { rows: [{ rolsuper: false, rolbypassrls: true }] }
    })
    expect(result).toEqual({ ok: false, reason: 'db_role_has_bypassrls' })
  })
})
