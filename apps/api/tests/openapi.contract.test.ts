import { describe, expect, it } from 'vitest'
import { openApiDocument } from '../src/http/openapi.js'

describe('openapi contract (Phase 1)', () => {
  it('exposes required paths', () => {
    const paths = Object.keys(openApiDocument.paths).sort()
    expect(paths).toEqual(
      [
        '/healthz',
        '/readyz',
        '/v1/articles','/v1/articles/import','/v1/articles/import/preview','/v1/articles/{id}','/v1/articles/{id}/status','/v1/articles/{id}/suppliers','/v1/articles/{id}/suppliers/{relationId}',
        '/v1/assignments',
        '/v1/assignments/{id}/close',
        '/v1/attendance',
        '/v1/attendance/codes',
        '/v1/attendance/{id}/justification',
        '/v1/attendance/{id}/justification/download',
        '/v1/clients',
        '/v1/clients/{id}',
        '/v1/clients/{id}/addresses',
        '/v1/clients/{id}/addresses/{addressId}',
        '/v1/clients/{id}/addresses/{addressId}/principal',
        '/v1/clients/{id}/addresses/{addressId}/status',
        '/v1/clients/{id}/quotes',
        '/v1/clients/{id}/quotes/{quoteId}',
        '/v1/clients/{id}/quotes/{quoteId}/download',
        '/v1/crm/catalogs','/v1/crm/dashboard','/v1/crm/summary','/v1/crm/opportunities','/v1/crm/opportunities/{id}','/v1/crm/opportunities/{id}/follow-ups','/v1/crm/opportunities/{id}/state','/v1/crm/opportunities/{id}/view','/v1/crm/prospects','/v1/crm/prospects/{id}','/v1/crm/{resource}','/v1/crm/{resource}/{id}/status',
        '/v1/audits','/v1/audits/catalogs','/v1/audits/dashboard','/v1/audits/plannings','/v1/audits/plannings/{id}','/v1/audits/plannings/{id}/cancel','/v1/audits/{id}','/v1/audits/{id}/actions',
        '/v1/audit-actions','/v1/audit-actions/{id}',
        '/v1/audit-checklists','/v1/audit-checklists/active','/v1/audit-checklists/{id}','/v1/audit-checklists/{id}/activate','/v1/audit-checklists/{id}/copy',
        '/v1/employees',
        '/v1/employees/{id}/status',
        '/v1/hr/catalogs',
        '/v1/hr/reports/bejerman',
        '/v1/hr/reports/overtime',
        '/v1/me',
        '/v1/price-lists/apply','/v1/price-lists/preview','/v1/supplier-article-pending','/v1/supplier-article-pending/{id}/resolve','/v1/suppliers','/v1/suppliers/{id}','/v1/suppliers/{id}/articles','/v1/suppliers/{id}/status',
        '/v1/purchases/catalogs','/v1/purchase-requests','/v1/purchase-requests/{id}','/v1/purchase-requests/{id}/state','/v1/purchase-requests/{id}/duplicate','/v1/purchase-request-items/{id}/discard','/v1/purchase-requests/{id}/assignments','/v1/purchase-requests/import/preview','/v1/purchase-requests/import/apply',
        '/v1/purchase-orders','/v1/purchase-orders/{id}','/v1/purchase-orders/{id}/state','/v1/purchase-orders/{id}/duplicate',
        '/v1/warehouse-requests','/v1/warehouse-requests/{id}','/v1/warehouse-requests/{id}/state','/v1/warehouse-requests/{id}/duplicate',
        '/v1/results','/v1/results/{id}','/v1/results/import/preview','/v1/results/import/apply',
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

  it('documents the complete Phase 4A client surface', () => {
    expect(openApiDocument.paths['/v1/clients'].post.security).toEqual([{ bearerAuth: [] }])
    expect(openApiDocument.paths['/v1/clients/{id}'].patch.responses['404']).toBeTruthy()
    expect(openApiDocument.paths['/v1/clients/{id}/addresses/{addressId}/principal'].post).toBeTruthy()
    expect(openApiDocument.paths['/v1/clients/{id}/quotes'].post.responses['413']).toBeTruthy()
    expect(openApiDocument.paths['/v1/clients/{id}/quotes'].post.parameters).toContainEqual(expect.objectContaining({ name:'Idempotency-Key',in:'header',required:true }))
    expect(openApiDocument.paths['/v1/clients/{id}/quotes/{quoteId}/download'].get).toBeTruthy()
    expect(openApiDocument.paths['/v1/clients/{id}/quotes/{quoteId}'].delete.responses['502']).toBeTruthy()
    expect(openApiDocument.components.schemas.ClientDetail).toBeTruthy()
    expect(openApiDocument.components.schemas.QuoteDownload).toBeTruthy()
  })

  it('documents the Phase 5A CRM surface and concurrency contract', () => {
    expect(openApiDocument.paths['/v1/crm/opportunities'].post.parameters).toContainEqual(expect.objectContaining({ name: 'Idempotency-Key', in: 'header', required: true }))
    expect(openApiDocument.paths['/v1/crm/opportunities/{id}'].patch.responses['409']).toBeTruthy()
    expect(openApiDocument.paths['/v1/crm/opportunities/{id}/state'].patch.responses['409']).toBeTruthy()
    expect(openApiDocument.paths['/v1/crm/{resource}'].post.responses['409']).toBeTruthy()
  })

  it('documents the Phase 5B audits surface with auth/errors and idempotency', () => {
    expect(openApiDocument.paths['/v1/audits'].post.parameters).toContainEqual(
      expect.objectContaining({ name: 'Idempotency-Key', in: 'header', required: true }),
    )
    expect(openApiDocument.paths['/v1/audit-checklists/{id}/copy'].post.parameters).toContainEqual(
      expect.objectContaining({ name: 'Idempotency-Key', in: 'header', required: true }),
    )
    expect(openApiDocument.paths['/v1/audits/dashboard'].get.security).toEqual([{ bearerAuth: [] }])
    expect(openApiDocument.paths['/v1/audits/plannings/{id}'].patch.responses['409']).toBeTruthy()
    expect(openApiDocument.paths['/v1/audit-actions/{id}'].patch.responses['409']).toBeTruthy()
    expect(openApiDocument.paths['/v1/audit-checklists/{id}'].patch.responses['409']).toBeTruthy()
    expect(openApiDocument.paths['/v1/audit-checklists/active'].get.responses['404']).toBeTruthy()
  })
})
