import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import {
  attendanceIdParamsSchema,
  attendanceQuerySchema,
  attendanceUpsertSchema,
  justificationUploadBodySchema,
} from '../../schemas/attendance.js'

function id(value: unknown) {
  const parsed = attendanceIdParamsSchema.safeParse({ id: value })
  if (!parsed.success) throw badRequest('Invalid attendance id')
  return parsed.data.id
}

export const attendanceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/attendance', { preHandler: [requirePermission('attendance:read')] }, async (req) => {
    const q = attendanceQuerySchema.safeParse(req.query)
    if (!q.success) throw badRequest('Invalid attendance query', q.error.flatten())
    return app.attendanceService.list(q.data)
  })
  app.get('/v1/attendance/codes', { preHandler: [requirePermission('attendance:read')] }, async () =>
    app.attendanceService.codes(),
  )
  app.put('/v1/attendance', { preHandler: [requirePermission('attendance:update')] }, async (req, reply) => {
    const body = attendanceUpsertSchema.safeParse(req.body)
    if (!body.success) throw badRequest('Invalid attendance body', body.error.flatten())
    return reply.status(200).send(await app.attendanceService.upsert(body.data, req.auth!.userId))
  })
  app.post(
    '/v1/attendance/:id/justification',
    { bodyLimit: 22_000_000, preHandler: [requirePermission('attendance:update')] },
    async (req, reply) => {
      const body = justificationUploadBodySchema.safeParse(req.body)
      if (!body.success) throw badRequest('Invalid justification upload')
      const attendanceId = id((req.params as { id?: unknown }).id)
      const result = await app.attendanceJustificationsService.upload({
        attendanceId,
        ...body.data,
        actorId: req.auth!.userId,
        requestId: req.id,
      })
      return reply.code(201).send(result)
    },
  )
  app.get(
    '/v1/attendance/:id/justification/download',
    { preHandler: [requirePermission('attendance:read')] },
    async (req) => {
      const attendanceId = id((req.params as { id?: unknown }).id)
      return app.attendanceJustificationsService.download(attendanceId)
    },
  )
  app.delete(
    '/v1/attendance/:id/justification',
    { preHandler: [requirePermission('attendance:update')] },
    async (req, reply) => {
      const attendanceId = id((req.params as { id?: unknown }).id)
      await app.attendanceJustificationsService.remove({
        attendanceId,
        actorId: req.auth!.userId,
        requestId: req.id,
      })
      return reply.code(204).send()
    },
  )
}
