import { describe, expect, it } from 'vitest'
import { openApiDocument } from '../src/http/openapi.js'

describe('openapi contract (Phase 1)', () => {
  it('exposes required paths', () => {
    const paths = Object.keys(openApiDocument.paths).sort()
    expect(paths).toEqual(
      [
        '/healthz',
        '/readyz',
        '/v1/assignments',
        '/v1/assignments/{id}/close',
        '/v1/employees',
        '/v1/employees/{id}/status',
        '/v1/hr/catalogs',
        '/v1/me',
        '/v1/users',
        '/v1/users/{id}',
        '/v1/users/{id}/disable',
        '/v1/users/{id}/enable',
        '/v1/users/{id}/password',
        '/v1/users/{id}/role',
      ].sort(),
    )
  })

  it('declares bearerAuth security scheme', () => {
    const scheme = openApiDocument.components.securitySchemes.bearerAuth
    expect(scheme).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
  })

  it('GET /v1/me requires bearerAuth', () => {
    expect(openApiDocument.paths['/v1/me'].get.security).toEqual([{ bearerAuth: [] }])
  })

  it('GET /v1/employees requires bearerAuth and documents query params', () => {
    const op = openApiDocument.paths['/v1/employees'].get
    expect(op.security).toEqual([{ bearerAuth: [] }])
    const names = op.parameters.map((p) => p.name).sort()
    expect(names).toEqual(['activo', 'clienteId', 'page', 'pageSize', 'search'])
    for (const p of op.parameters) {
      expect(p.in).toBe('query')
    }
  })

  it('documents EmployeesResponse schema component', () => {
    expect(openApiDocument.components.schemas.EmployeesResponse).toBeTruthy()
    expect(openApiDocument.components.schemas.ListEmployeesQuery).toBeTruthy()
  })

  it('documents Phase 3A mutations, assignments and catalogs with auth/errors', () => {
    const employees = openApiDocument.paths['/v1/employees']
    expect(employees.post.security).toEqual([{ bearerAuth: [] }])
    expect(employees.post.responses['409']).toBeTruthy()
    expect(openApiDocument.paths['/v1/employees/{id}/status'].patch.responses['404']).toBeTruthy()
    expect(openApiDocument.paths['/v1/assignments'].get.security).toEqual([{ bearerAuth: [] }])
    expect(openApiDocument.paths['/v1/assignments'].post.responses['404']).toBeTruthy()
    expect(openApiDocument.paths['/v1/assignments/{id}/close'].patch.responses['409']).toBeTruthy()
    expect(openApiDocument.paths['/v1/hr/catalogs'].get.security).toEqual([{ bearerAuth: [] }])
    expect(openApiDocument.components.schemas.CreateEmployeeBody).toBeTruthy()
    expect(openApiDocument.components.schemas.AssignmentsResponse).toBeTruthy()
    expect(openApiDocument.components.schemas.HrCatalogsResponse).toBeTruthy()
  })
})
