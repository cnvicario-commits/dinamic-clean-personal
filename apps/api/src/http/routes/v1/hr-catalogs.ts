import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import { hrCatalogsQuerySchema } from '../../schemas/hr-catalogs.js'

export const hrCatalogsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/hr/catalogs', { preHandler: [requirePermission('assignments:read')] }, async (request) => {
    const parsed = hrCatalogsQuerySchema.safeParse(request.query)
    if (!parsed.success) throw badRequest('Invalid catalog query', parsed.error.flatten())
    return app.hrCatalogsRepo.list(parsed.data)
  })
}
