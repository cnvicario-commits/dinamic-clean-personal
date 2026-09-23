import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { listEmployees, parseListEmployeesQuery } from '../../../application/employees/list-employees.js'
import { createEmployee, updateEmployeeStatus } from '../../../application/employees/mutate-employees.js'

export const employeesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/employees', { preHandler: [requirePermission('employees:read')] }, async (request) =>
    listEmployees(app.employeesRepo, parseListEmployeesQuery(request.query as Record<string, unknown>)))

  app.post('/v1/employees', { preHandler: [requirePermission('employees:create')] }, async (request, reply) => {
    const employee = await createEmployee(app.employeesRepo, request.body)
    return reply.status(201).send(employee)
  })

  app.patch('/v1/employees/:id/status', { preHandler: [requirePermission('employees:update')] }, async (request) => {
    const { id } = request.params as { id?: unknown }
    return updateEmployeeStatus(app.employeesRepo, id, request.body)
  })
}
