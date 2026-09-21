import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { requirePermission, requireMfaForPrivilegedActor } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import {
  changeUserRole,
  createUser,
  disableUser,
  enableUser,
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
    logAdminAction: (payload: {
      requestId?: string
      actorUserId?: string
      targetUserId: string
      action: string
      result: 'ok' | 'error'
    }) => {
      app.log.info(payload, 'user_admin_action')
    },
  }
}

const privileged = [requireMfaForPrivilegedActor()]

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
    { preHandler: [requirePermission('users:create'), ...privileged] },
    async (request, reply) => {
      const input = parseCreateUserBody(requireObjectBody(request.body))
      const created = await createUser(usersDeps(app), input, { requestId: request.id })
      return reply.code(201).send(created)
    },
  )

  app.patch<{ Params: { id: string } }>(
    '/v1/users/:id/role',
    { preHandler: [requirePermission('users:change_role'), ...privileged] },
    async (request) => {
      const id = parseUserIdParam(request.params.id)
      const input = parseChangeUserRoleBody(requireObjectBody(request.body))
      return changeUserRole(usersDeps(app), id, input.rol, {
        actorUserId: request.auth!.userId,
        requestId: request.id,
      })
    },
  )

  app.post<{ Params: { id: string } }>(
    '/v1/users/:id/password',
    { preHandler: [requirePermission('users:set_password'), ...privileged] },
    async (request, reply) => {
      const id = parseUserIdParam(request.params.id)
      const input = parseSetUserPasswordBody(requireObjectBody(request.body))
      await setUserPassword(usersDeps(app), id, input.password, {
        actorUserId: request.auth!.userId,
        requestId: request.id,
      })
      return reply.code(204).send()
    },
  )

  app.post<{ Params: { id: string } }>(
    '/v1/users/:id/disable',
    { preHandler: [requirePermission('users:disable'), ...privileged] },
    async (request, reply) => {
      const id = parseUserIdParam(request.params.id)
      await disableUser(usersDeps(app), id, {
        userId: request.auth!.userId,
        requestId: request.id,
      })
      return reply.code(204).send()
    },
  )

  app.post<{ Params: { id: string } }>(
    '/v1/users/:id/enable',
    { preHandler: [requirePermission('users:enable'), ...privileged] },
    async (request, reply) => {
      const id = parseUserIdParam(request.params.id)
      await enableUser(usersDeps(app), id, {
        userId: request.auth!.userId,
        requestId: request.id,
      })
      return reply.code(204).send()
    },
  )
}
