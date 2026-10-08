import { describe, expect, it } from 'vitest'
import { GENERATED_ROLES } from '../../../src/lib/api/generated/types.js'
import { ROLE_UI_METADATA, ROLES } from '../../../src/utils/permisos.js'

describe('frontend role UI metadata parity', () => {
  it('ROLE_UI_METADATA covers every GENERATED_ROLES entry exactly once', () => {
    for (const role of GENERATED_ROLES) {
      expect(ROLE_UI_METADATA[role]?.etiqueta, `missing label for ${role}`).toBeTruthy()
    }
    expect(Object.keys(ROLE_UI_METADATA).sort()).toEqual([...GENERATED_ROLES].sort())
  })

  it('ROLES list mirrors GENERATED_ROLES with labels', () => {
    expect(ROLES.map((r) => r.valor)).toEqual([...GENERATED_ROLES])
    for (const { valor, etiqueta } of ROLES) {
      expect(etiqueta).toBe(ROLE_UI_METADATA[valor].etiqueta)
    }
  })
})
