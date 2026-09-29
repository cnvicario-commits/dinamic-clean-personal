import type { FastifyPluginAsync,FastifyRequest } from 'fastify'
import type { z } from 'zod'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import { uuid,idempotencyKey,purchaseRequest,transition,discard,assignments,purchaseOrder,importBody } from '../../schemas/purchases.js'
const id=(v:unknown)=>{const p=uuid.safeParse(v);if(!p.success)throw badRequest('Invalid id');return p.data}
const body=<T extends z.ZodType>(s:T,x:unknown):z.infer<T>=>{const p=s.safeParse(x);if(!p.success)throw badRequest('Invalid purchases payload',p.error.flatten());return p.data}
const actor=(r:FastifyRequest)=>({userId:r.auth!.userId,requestId:r.id})
const key=(r:FastifyRequest)=>{const p=idempotencyKey.safeParse(r.headers['idempotency-key']);if(!p.success)throw badRequest('Idempotency-Key header is required');return p.data}
export const purchasesRoutes:FastifyPluginAsync=async app=>{
 app.get('/v1/purchases/catalogs',{preHandler:[requirePermission('purchase_requests:read')]},()=>app.purchasesService.catalogs())
 app.get('/v1/purchase-requests',{preHandler:[requirePermission('purchase_requests:read')]},()=>app.purchasesService.listRequests())
 app.get('/v1/purchase-requests/:id',{preHandler:[requirePermission('purchase_requests:read')]},r=>app.purchasesService.request(id((r.params as {id:unknown}).id)))
 app.post('/v1/purchase-requests',{preHandler:[requirePermission('purchase_requests:create')]},async(r,reply)=>reply.code(201).send(await app.purchasesService.createRequest(body(purchaseRequest,r.body),actor(r))))
 app.put('/v1/purchase-requests/:id',{preHandler:[requirePermission('purchase_requests:update')]},r=>app.purchasesService.updateRequest(id((r.params as {id:unknown}).id),body(purchaseRequest,r.body),actor(r)))
 app.patch('/v1/purchase-requests/:id/state',{preHandler:[requirePermission('purchase_requests:update')]},r=>app.purchasesService.transition('pedidos_compra',id((r.params as {id:unknown}).id),body(transition,r.body).estado,actor(r)))
 app.post('/v1/purchase-requests/:id/duplicate',{preHandler:[requirePermission('purchase_requests:create')]},async(r,reply)=>reply.code(201).send(await app.purchasesService.duplicate('request',id((r.params as {id:unknown}).id),actor(r))))
 app.patch('/v1/purchase-request-items/:id/discard',{preHandler:[requirePermission('purchase_requests:update')]},r=>app.purchasesService.discard(id((r.params as {id:unknown}).id),body(discard,r.body),actor(r)))
 app.post('/v1/purchase-requests/import/preview',{preHandler:[requirePermission('purchase_requests:create')]},r=>app.purchasesService.previewImport(body(importBody,r.body)))
 app.post('/v1/purchase-requests/import/apply',{preHandler:[requirePermission('purchase_requests:create')]},r=>app.purchasesService.applyImport(body(importBody,r.body),key(r),actor(r)))
 app.post('/v1/purchase-requests/:id/assignments',{preHandler:[requirePermission('purchase_orders:create')]},r=>app.purchasesService.assign(id((r.params as {id:unknown}).id),body(assignments,r.body),key(r),actor(r)))
 app.get('/v1/purchase-orders',{preHandler:[requirePermission('purchase_orders:read')]},()=>app.purchasesService.listOrders())
 app.get('/v1/purchase-orders/:id',{preHandler:[requirePermission('purchase_orders:read')]},r=>app.purchasesService.order(id((r.params as {id:unknown}).id)))
 app.post('/v1/purchase-orders',{preHandler:[requirePermission('purchase_orders:create')]},async(r,reply)=>reply.code(201).send(await app.purchasesService.createOrder(body(purchaseOrder,r.body),actor(r))))
 app.patch('/v1/purchase-orders/:id/state',{preHandler:[requirePermission('purchase_orders:update')]},r=>app.purchasesService.transition('ordenes_compra',id((r.params as {id:unknown}).id),body(transition,r.body).estado,actor(r)))
 app.post('/v1/purchase-orders/:id/duplicate',{preHandler:[requirePermission('purchase_orders:create')]},async(r,reply)=>reply.code(201).send(await app.purchasesService.duplicate('order',id((r.params as {id:unknown}).id),actor(r))))
 app.get('/v1/warehouse-requests',{preHandler:[requirePermission('warehouse_requests:read')]},()=>app.purchasesService.listWarehouses())
 app.get('/v1/warehouse-requests/:id',{preHandler:[requirePermission('warehouse_requests:read')]},r=>app.purchasesService.warehouse(id((r.params as {id:unknown}).id)))
 app.patch('/v1/warehouse-requests/:id/state',{preHandler:[requirePermission('warehouse_requests:update')]},r=>app.purchasesService.transition('pedidos_deposito',id((r.params as {id:unknown}).id),body(transition,r.body).estado,actor(r)))
 app.post('/v1/warehouse-requests/:id/duplicate',{preHandler:[requirePermission('warehouse_requests:create')]},async(r,reply)=>reply.code(201).send(await app.purchasesService.duplicate('warehouse',id((r.params as {id:unknown}).id),actor(r))))
}
