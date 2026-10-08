import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import {
  buildMeResponse,
  parseUpdateOwnProfileBody,
  updateOwnProfile,
} from '../../../application/users/users-service.js'
import { badRequest } from '../../errors/app-error.js'

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/v1/me',
    { preHandler: [requirePermission('profile:read_self')] },
    async (request) => {
      const auth = request.auth!
      // Profile + revocation already resolved in authenticateRequest — no second lookup.
      return buildMeResponse(auth, {
        profileId: auth.profileId,
        role: auth.role,
        nombreCompleto: auth.nombreCompleto,
      })
    },
  )

  app.patch(
    '/v1/me',
    { preHandler: [requirePermission('profile:update_self')] },
    async (request) => {
      const auth = request.auth!
      if (request.body === null || typeof request.body !== 'object' || Array.isArray(request.body)) {
        throw badRequest('Request body must be a JSON object')
      }
      const input = parseUpdateOwnProfileBody(request.body)
      // Target is auth.userId only — never from body.
      return updateOwnProfile(app.profilesRepo, auth.userId, input)
    },
  )
}
