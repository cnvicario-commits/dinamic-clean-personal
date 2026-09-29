import type { FastifyPluginAsync } from 'fastify'
import type { z } from 'zod'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import { resultsImport,resultsQuery } from '../../schemas/results.js'
const parse=<T>(schema:z.ZodType<T>,v:unknown):T=>{const p=schema.safeParse(v);if(!p.success)throw badRequest('Invalid results payload',p.error.flatten());return p.data}
export const resultsRoutes:FastifyPluginAsync=async app=>{
 app.get('/v1/results',{preHandler:[requirePermission('economic_results:read')]},r=>app.resultsService.list(parse(resultsQuery,r.query) as {anio?:number;mes?:number}))
 app.get('/v1/results/:id',{preHandler:[requirePermission('economic_results:read')]},r=>app.resultsService.detail(String((r.params as {id:string}).id)))
 app.post('/v1/results/import/preview',{preHandler:[requirePermission('economic_results:import')]},r=>app.resultsService.preview(parse(resultsImport,r.body)))
 app.post('/v1/results/import/apply',{preHandler:[requirePermission('economic_results:import')]},r=>{const key=r.headers['idempotency-key'];if(typeof key!=='string'||key.length<8)throw badRequest('Idempotency-Key header is required');return app.resultsService.apply(parse(resultsImport,r.body),key,{userId:r.auth!.userId,requestId:r.id})})
}
