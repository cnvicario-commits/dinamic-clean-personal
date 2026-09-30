import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import {
  actionCreate,
  actionListQuery,
  actionUpdate,
  auditListQuery,
  auditPageQuery,
  auditSubmit,
  checklistActivate,
  checklistCopy,
  checklistCreate,
  checklistUpdate,
  dashboardQuery,
  planningBody,
  planningCancel,
  planningUpdate,
} from '../../schemas/audits.js'
import { z } from 'zod'

const idSchema = z.string().uuid()

const parseId = (value: unknown) => {
  const parsed = idSchema.safeParse(value)
  if (!parsed.success) throw badRequest('Invalid audit id')
  return parsed.data
}

const parse = <T>(
  schema: { safeParse: (x: unknown) => { success: boolean; data?: T } },
  value: unknown,
) => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw badRequest('Invalid audits payload')
  return parsed.data!
}

const idempotencyKey = (request: FastifyRequest) => {
  const value = request.headers['idempotency-key']
  if (typeof value !== 'string' || !value.trim()) {
    throw badRequest('Idempotency-Key header is required')
  }
  return value
}

const actor = (request: FastifyRequest) => request.auth!.userId

export const auditsRoutes: FastifyPluginAsync = async app => {
  const read = { preHandler: [requirePermission('audits:read')] }
  const create = { preHandler: [requirePermission('audits:create')] }
  const update = { preHandler: [requirePermission('audits:update')] }
  const manage = { preHandler: [requirePermission('audit_checklists:manage')] }

  // Static / collection paths before /:id patterns.
  app.get('/v1/audits/dashboard', read, request => {
    const query = dashboardQuery.safeParse(request.query)
    if (!query.success) throw badRequest('Invalid audits query')
    return app.auditsService.dashboard(query.data)
  })

  app.get('/v1/audits/catalogs', read, () => app.auditsService.catalogs())

  app.get('/v1/audits/plannings', read, request => {
    const query = auditListQuery.safeParse(request.query)
    if (!query.success) throw badRequest('Invalid audits query')
    return app.auditsService.plans(query.data)
  })

  app.get('/v1/audits/plannings/:id', read, request =>
    app.auditsService.planningById(parseId((request.params as { id: unknown }).id)),
  )

  app.post('/v1/audits/plannings', create, async (request, reply) =>
    reply.code(201).send(await app.auditsService.createPlanning(parse(planningBody, request.body))),
  )

  app.patch('/v1/audits/plannings/:id', update, request =>
    app.auditsService.updatePlanning(
      parseId((request.params as { id: unknown }).id),
      parse(planningUpdate, request.body),
    ),
  )

  app.post('/v1/audits/plannings/:id/cancel', update, request =>
    app.auditsService.cancelPlanning(
      parseId((request.params as { id: unknown }).id),
      parse(planningCancel, request.body).updatedAt,
    ),
  )

  app.get('/v1/audits', read, request => {
    const query = auditPageQuery.safeParse(request.query)
    if (!query.success) throw badRequest('Invalid audits query')
    return app.auditsService.listAudits(query.data)
  })

  app.post('/v1/audits', create, async (request, reply) =>
    reply.code(201).send(
      await app.auditsService.submit(
        parse(auditSubmit, request.body),
        actor(request),
        idempotencyKey(request),
      ),
    ),
  )

  app.get('/v1/audits/:id', read, request =>
    app.auditsService.auditDetail(parseId((request.params as { id: unknown }).id)),
  )

  app.get('/v1/audits/:id/actions', read, request =>
    app.auditsService.listActionsForAudit(parseId((request.params as { id: unknown }).id)),
  )

  app.post('/v1/audits/:id/actions', create, async (request, reply) =>
    reply.code(201).send(
      await app.auditsService.createAction(
        parseId((request.params as { id: unknown }).id),
        parse(actionCreate, request.body),
      ),
    ),
  )

  app.get('/v1/audit-actions', read, request => {
    const query = actionListQuery.safeParse(request.query)
    if (!query.success) throw badRequest('Invalid audits query')
    return app.auditsService.listActions(query.data)
  })

  app.patch('/v1/audit-actions/:id', update, request =>
    app.auditsService.updateAction(
      parseId((request.params as { id: unknown }).id),
      parse(actionUpdate, request.body),
    ),
  )

  app.get('/v1/audit-checklists', read, () => app.auditsService.listChecklists())

  app.get('/v1/audit-checklists/active', read, () => app.auditsService.checklistActive())

  app.post('/v1/audit-checklists', manage, async (request, reply) =>
    reply.code(201).send(await app.auditsService.checklistCreate(parse(checklistCreate, request.body))),
  )

  app.get('/v1/audit-checklists/:id', read, request =>
    app.auditsService.checklistDetail(parseId((request.params as { id: unknown }).id)),
  )

  app.patch('/v1/audit-checklists/:id', manage, request =>
    app.auditsService.checklistUpdate(
      parseId((request.params as { id: unknown }).id),
      parse(checklistUpdate, request.body),
    ),
  )

  app.post('/v1/audit-checklists/:id/copy', manage, async (request, reply) =>
    reply.code(201).send(
      await app.auditsService.checklistCopy(
        parseId((request.params as { id: unknown }).id),
        parse(checklistCopy, request.body),
        actor(request),
        idempotencyKey(request),
      ),
    ),
  )

  app.post('/v1/audit-checklists/:id/activate', manage, request =>
    app.auditsService.checklistActivate(
      parseId((request.params as { id: unknown }).id),
      parse(checklistActivate, request.body).updatedAt,
    ),
  )
}
