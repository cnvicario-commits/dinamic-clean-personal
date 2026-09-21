import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import {
  changeUserRole,
  createUser,
  getUser,
  listUsers,
  parseChangeUserRoleBody,
  parseCreateUserBody,
  parseSetUserPasswordBody,
  parseUserIdParam,
  setUserPassword,
} from '../../../application/users/users-service.js'

function requireObjectBody(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object')
  }
  return body as Record<string, unknown>
}

function usersDeps(app: FastifyInstance) {
  return {
    identity: app.identityAdmin,
    profiles: app.profilesRepo,
    logOrphan: (payload: { requestId?: string; authUserId: string }) => {
      app.log.error(payload, 'user_create_orphan')
    },
  }
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/v1/users',
    { preHandler: [requirePermission('profiles:read_any')] },
    async () => listUsers(usersDeps(app)),
  )

  app.get<{ Params: { id: string } }>(
    '/v1/users/:id',
    { preHandler: [requirePermission('profiles:read_any')] },
    async (request) => {
      const id = parseUserIdParam(request.params.id)
      return getUser(usersDeps(app), id)
    },
  )

  app.post(
    '/v1/users',
    { preHandler: [requirePermission('users:create')] },
    async (request, reply) => {
      const input = parseCreateUserBody(requireObjectBody(request.body))
      const created = await createUser(usersDeps(app), input, { requestId: request.id })
      return reply.code(201).send(created)
    },
  )

  app.patch<{ Params: { id: string } }>(
    '/v1/users/:id/role',
    { preHandler: [requirePermission('users:change_role')] },
    async (request) => {
      const id = parseUserIdParam(request.params.id)
      const input = parseChangeUserRoleBody(requireObjectBody(request.body))
      return changeUserRole(app.profilesRepo, id, input.rol)
    },
  )

  app.post<{ Params: { id: string } }>(
    '/v1/users/:id/password',
    { preHandler: [requirePermission('users:set_password')] },
    async (request, reply) => {
      const id = parseUserIdParam(request.params.id)
      const input = parseSetUserPasswordBody(requireObjectBody(request.body))
      await setUserPassword(usersDeps(app), id, input.password)
      return reply.code(204).send()
    },
  )
}
