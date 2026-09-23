import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
const q=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict()
export const hrReportsRoutes:FastifyPluginAsync=async(app)=>{
  app.get('/v1/hr/reports/bejerman',{preHandler:[requirePermission('attendance:export')]},async(req)=>{const x=q.safeParse(req.query);if(!x.success)throw badRequest('Invalid report range',x.error.flatten());return app.hrReportsRepo.bejerman(x.data.from,x.data.to)})
  app.get('/v1/hr/reports/overtime',{preHandler:[requirePermission('attendance:export')]},async(req)=>{const x=q.safeParse(req.query);if(!x.success)throw badRequest('Invalid report range',x.error.flatten());return app.hrReportsRepo.overtime(x.data.from,x.data.to)})
}
