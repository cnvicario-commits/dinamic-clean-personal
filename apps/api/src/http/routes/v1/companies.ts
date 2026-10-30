import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import {
  createCompany,
  updateCompany,
  updateCompanyStatus,
} from '../../../application/companies/mutate-companies.js'

export const companiesRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/companies', { preHandler: [requirePermission('companies:create')] }, async (request, reply) => {
    const company = await createCompany(app.companiesRepo, request.body)
    return reply.status(201).send(company)
  })

  app.patch('/v1/companies/:id', { preHandler: [requirePermission('companies:update')] }, async (request) => {
    const { id } = request.params as { id?: unknown }
    return updateCompany(app.companiesRepo, id, request.body)
  })

  app.patch('/v1/companies/:id/status', { preHandler: [requirePermission('companies:update')] }, async (request) => {
    const { id } = request.params as { id?: unknown }
    return updateCompanyStatus(app.companiesRepo, id, request.body)
  })
}
