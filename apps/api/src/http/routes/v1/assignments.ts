import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { closeAssignment, createAssignment, listAssignments } from '../../../application/assignments/assignments-service.js'

export const assignmentsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/assignments', { preHandler: [requirePermission('assignments:read')] }, async (request) =>
    listAssignments(app.assignmentsRepo, request.query as Record<string, unknown>))

  app.post('/v1/assignments', { preHandler: [requirePermission('assignments:create')] }, async (request, reply) => {
    const assignment = await createAssignment(app.assignmentsRepo, request.body)
    return reply.status(201).send(assignment)
  })

  app.patch('/v1/assignments/:id/close', { preHandler: [requirePermission('assignments:update')] }, async (request) => {
    const { id } = request.params as { id?: unknown }
    return closeAssignment(app.assignmentsRepo, id)
  })
}
