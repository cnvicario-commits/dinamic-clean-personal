import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { permissionsFor } from '../../../domain/rbac.js'

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/v1/me',
    { preHandler: [requirePermission('profile:read_self')] },
    async (request) => {
      const auth = request.auth!
      return {
        userId: auth.userId,
        profileId: auth.profileId,
        role: auth.role,
        email: auth.email,
        permissions: permissionsFor(auth.role),
      }
    },
  )
}
