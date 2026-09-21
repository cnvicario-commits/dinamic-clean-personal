import { describe, expect, it } from 'vitest'
import { PERMISSIONS, ROLES } from '../src/domain/rbac.js'
import { openApiDocument } from '../src/http/openapi.js'
import { permissionSchema } from '../src/http/schemas/users.js'
import {
  GENERATED_PERMISSIONS,
  GENERATED_ROLES,
} from '../../../src/lib/api/generated/types.js'

describe('RBAC / OpenAPI contract parity', () => {
  it('backend ROLES === frontend GENERATED_ROLES (exact)', () => {
    expect([...GENERATED_ROLES].sort()).toEqual([...ROLES].sort())
    expect(GENERATED_ROLES).toHaveLength(ROLES.length)
    const missingFe = ROLES.filter((r) => !GENERATED_ROLES.includes(r))
    const extraFe = GENERATED_ROLES.filter((r) => !(ROLES as readonly string[]).includes(r))
    expect(missingFe, `missing frontend roles: ${missingFe.join(',')}`).toEqual([])
    expect(extraFe, `extra/obsolete frontend roles: ${extraFe.join(',')}`).toEqual([])
  })

  it('backend PERMISSIONS === frontend GENERATED_PERMISSIONS (exact)', () => {
    expect([...GENERATED_PERMISSIONS].sort()).toEqual([...PERMISSIONS].sort())
    expect(GENERATED_PERMISSIONS).toHaveLength(PERMISSIONS.length)
    const missingFe = PERMISSIONS.filter((p) => !GENERATED_PERMISSIONS.includes(p))
    const extraFe = GENERATED_PERMISSIONS.filter(
      (p) => !(PERMISSIONS as readonly string[]).includes(p),
    )
    expect(missingFe, `missing frontend permissions: ${missingFe.join(',')}`).toEqual([])
    expect(extraFe, `extra/obsolete frontend permissions: ${extraFe.join(',')}`).toEqual([])
  })

  it('permissionSchema accepts known Permission and rejects unknown', () => {
    for (const permission of PERMISSIONS) {
      expect(permissionSchema.safeParse(permission).success).toBe(true)
    }
    expect(permissionSchema.safeParse('users:delete').success).toBe(false)
    expect(permissionSchema.safeParse('*').success).toBe(false)
    expect(permissionSchema.safeParse('employees.read').success).toBe(false)
    expect(permissionSchema.safeParse('').success).toBe(false)
  })

  it('OpenAPI MeResponse permissions use Permission enum (not bare string[])', () => {
    const me = openApiDocument.components.schemas.MeResponse as {
      properties?: { permissions?: { items?: { enum?: string[]; type?: string } } }
    }
    const items = me.properties?.permissions?.items
    expect(items?.enum).toEqual([...PERMISSIONS])
  })

  it('OpenAPI documents users paths and AdminUserResponse', () => {
    expect(openApiDocument.paths['/v1/users']).toBeTruthy()
    expect(openApiDocument.paths['/v1/users/{id}/role']).toBeTruthy()
    expect(openApiDocument.paths['/v1/users/{id}/password']).toBeTruthy()
    expect(openApiDocument.paths['/v1/me'].patch).toBeTruthy()
    expect(openApiDocument.components.schemas.AdminUserResponse).toBeTruthy()
    expect(openApiDocument.paths['/v1/users'].post.responses['409']).toBeTruthy()
    expect(openApiDocument.paths['/v1/users/{id}/password'].post.responses['204']).toBeTruthy()
  })
})
