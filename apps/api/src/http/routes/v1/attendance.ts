import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import { attendanceQuerySchema, attendanceUpsertSchema } from '../../schemas/attendance.js'
export const attendanceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/attendance',{preHandler:[requirePermission('attendance:read')]},async(req)=>{const q=attendanceQuerySchema.safeParse(req.query);if(!q.success)throw badRequest('Invalid attendance query',q.error.flatten());return app.attendanceService.list(q.data)})
  app.get('/v1/attendance/codes',{preHandler:[requirePermission('attendance:read')]},async()=>app.attendanceService.codes())
  app.put('/v1/attendance',{preHandler:[requirePermission('attendance:update')]},async(req,reply)=>{const body=attendanceUpsertSchema.safeParse(req.body);if(!body.success)throw badRequest('Invalid attendance body',body.error.flatten());return reply.status(200).send(await app.attendanceService.upsert(body.data,req.auth!.userId))})
}
