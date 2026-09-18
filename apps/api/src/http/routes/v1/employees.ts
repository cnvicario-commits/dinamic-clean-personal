import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { listEmployees, parseListEmployeesQuery } from '../../../application/employees/list-employees.js'

export const employeesRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/v1/employees',
    { preHandler: [requirePermission('employees:read')] },
    async (request) => {
      const input = parseListEmployeesQuery(request.query as Record<string, unknown>)
      return listEmployees(app.db, input)
    },
  )
}
