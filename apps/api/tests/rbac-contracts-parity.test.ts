import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PERMISSIONS, ROLES } from '../src/domain/rbac.js'
import { openApiDocument } from '../src/http/openapi.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('RBAC / OpenAPI contract parity', () => {
  it('generated FE types mention every backend Role and Permission', () => {
    const types = readFileSync(join(root, 'src/lib/api/generated/types.ts'), 'utf8')
    for (const role of ROLES) {
      expect(types).toContain(`'${role}'`)
    }
    for (const permission of PERMISSIONS) {
      expect(types).toContain(`'${permission}'`)
    }
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
