import type { FastifyPluginAsync } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import { reportDateRangeQuerySchema } from '../../schemas/hr-reports.js'
export const hrReportsRoutes:FastifyPluginAsync=async(app)=>{
  app.get('/v1/hr/reports/bejerman',{preHandler:[requirePermission('attendance:export')]},async(req)=>{const x=reportDateRangeQuerySchema.safeParse(req.query);if(!x.success)throw badRequest('Invalid report range',x.error.flatten());return app.hrReportsService.bejerman(x.data)})
  app.get('/v1/hr/reports/overtime',{preHandler:[requirePermission('attendance:export')]},async(req)=>{const x=reportDateRangeQuerySchema.safeParse(req.query);if(!x.success)throw badRequest('Invalid report range',x.error.flatten());return app.hrReportsService.overtime(x.data)})
}
