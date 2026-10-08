import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { requirePermission } from '../../plugins/auth.js'
import { badRequest } from '../../errors/app-error.js'
import {
  crmAgendaQuery,
  crmCatalogCreate,
  crmCatalogUpdate,
  crmConvertLead,
  crmCreateFollowUp,
  crmCreateLead,
  crmCreateLeadFollowUp,
  crmCreateOpportunity,
  crmCreateProspect,
  crmId,
  crmLeadListQuery,
  crmLeadTransition,
  crmListQuery,
  crmMonthlyQuery,
  crmTransition,
  crmUpdateLead,
  crmUpdateOpportunity,
  crmUpdateProspect,
} from '../../schemas/crm.js'
import { crmScope } from '../../../domain/crm-scope.js'

const id = (x: unknown) => {
  const p = crmId.safeParse(x)

  if (!p.success) {
    throw badRequest('Invalid CRM id')
  }

  return p.data
}

const body = <T>(
  s: { safeParse: (x: unknown) => { success: boolean; data?: T } },
  x: unknown,
) => {
  const p = s.safeParse(x)

  if (!p.success) {
    throw badRequest('Invalid CRM payload')
  }

  return p.data!
}

const key = (r: FastifyRequest) => {
  const p = r.headers['idempotency-key']

  if (typeof p !== 'string' || !p.trim()) {
    throw badRequest('Idempotency-Key header is required')
  }

  return p
}

const actor = (r: FastifyRequest) => r.auth!.userId
const scope = (r: FastifyRequest) => crmScope({ userId: r.auth!.userId, role: r.auth!.role })

export const crmRoutes: FastifyPluginAsync = async app => {
  const read = { preHandler: [requirePermission('crm:read')] }
  const create = { preHandler: [requirePermission('crm:create')] }
  const update = { preHandler: [requirePermission('crm:update')] }
  const del = { preHandler: [requirePermission('crm:delete')] }

  app.get('/v1/crm/opportunities', read, r => {
    const p = crmListQuery.safeParse(r.query)

    if (!p.success) {
      throw badRequest('Invalid CRM query')
    }

    return app.crmService.list(p.data, scope(r))
  })

  app.get('/v1/crm/dashboard', read, r => {
    const p = crmListQuery.safeParse(r.query)

    if (!p.success) {
      throw badRequest('Invalid CRM query')
    }

    return app.crmService.dashboard(actor(r), p.data, scope(r))
  })

  app.get('/v1/crm/summary', read, r => {
    const p = crmListQuery.safeParse(r.query)
    if (!p.success) throw badRequest('Invalid CRM query')
    return app.crmService.summary(p.data, scope(r))
  })

  app.get('/v1/crm/opportunities/:id', read, r =>
    app.crmService.detail(id((r.params as { id: unknown }).id), scope(r)),
  )

  app.delete('/v1/crm/opportunities/:id', del, async (r, reply) => {
    await app.crmService.deleteOpportunity(id((r.params as { id: unknown }).id), scope(r))
    return reply.code(204).send()
  })

  app.post('/v1/crm/opportunities', create, async (r, reply) =>
    reply.code(201).send(
      await app.crmService.createOpportunity(
        body(crmCreateOpportunity, r.body),
        scope(r),
        key(r),
      ),
    ),
  )

  app.patch('/v1/crm/opportunities/:id', update, r =>
    app.crmService.updateOpportunity(
      id((r.params as { id: unknown }).id),
      body(crmUpdateOpportunity, r.body),
      scope(r),
    ),
  )

  app.patch('/v1/crm/opportunities/:id/state', update, r =>
    app.crmService.transition(
      id((r.params as { id: unknown }).id),
      body(crmTransition, r.body),
      scope(r),
    ),
  )

  app.get('/v1/crm/opportunities/:id/follow-ups', read, r => {
    const q = crmListQuery.pick({ page: true, pageSize: true }).safeParse(r.query)

    if (!q.success) {
      throw badRequest('Invalid CRM query')
    }

    return app.crmService.followUps(id((r.params as { id: unknown }).id), q.data, scope(r))
  })

  app.post('/v1/crm/opportunities/:id/follow-ups', create, r =>
    app.crmService.createFollowUp(
      id((r.params as { id: unknown }).id),
      body(crmCreateFollowUp, r.body),
      scope(r),
    ),
  )

  app.put('/v1/crm/opportunities/:id/view', read, r =>
    app.crmService.markViewed(id((r.params as { id: unknown }).id), scope(r)),
  )

  app.get('/v1/crm/summary/monthly', read, r => {
    const p = crmMonthlyQuery.safeParse(r.query)
    if (!p.success) throw badRequest('Invalid CRM query')
    return app.crmService.monthly(p.data, scope(r))
  })

  app.get('/v1/crm/agenda', read, r => {
    const p = crmAgendaQuery.safeParse(r.query)
    if (!p.success) throw badRequest('Invalid CRM query')
    return app.crmService.agenda(p.data, scope(r))
  })

  app.get('/v1/crm/leads', read, r => {
    const p = crmLeadListQuery.safeParse(r.query)
    if (!p.success) throw badRequest('Invalid CRM query')
    return app.crmService.listLeads(p.data, scope(r))
  })

  app.post('/v1/crm/leads', create, async (r, reply) =>
    reply.code(201).send(
      await app.crmService.createLead(body(crmCreateLead, r.body), scope(r), key(r)),
    ),
  )

  app.get('/v1/crm/leads/:id', read, r =>
    app.crmService.detailLead(id((r.params as { id: unknown }).id), scope(r)),
  )

  app.patch('/v1/crm/leads/:id', update, r =>
    app.crmService.updateLead(
      id((r.params as { id: unknown }).id),
      body(crmUpdateLead, r.body),
      scope(r),
    ),
  )

  app.delete('/v1/crm/leads/:id', del, async (r, reply) => {
    await app.crmService.deleteLead(id((r.params as { id: unknown }).id), scope(r))
    return reply.code(204).send()
  })

  app.patch('/v1/crm/leads/:id/state', update, r =>
    app.crmService.transitionLead(
      id((r.params as { id: unknown }).id),
      body(crmLeadTransition, r.body),
      scope(r),
    ),
  )

  app.get('/v1/crm/leads/:id/follow-ups', read, r => {
    const q = crmLeadListQuery.pick({ page: true, pageSize: true }).safeParse(r.query)
    if (!q.success) throw badRequest('Invalid CRM query')
    return app.crmService.followUpsLead(id((r.params as { id: unknown }).id), q.data, scope(r))
  })

  app.post('/v1/crm/leads/:id/follow-ups', create, r =>
    app.crmService.createLeadFollowUp(
      id((r.params as { id: unknown }).id),
      body(crmCreateLeadFollowUp, r.body),
      scope(r),
    ),
  )

  app.post('/v1/crm/leads/:id/convert', create, async (r, reply) =>
    reply.code(201).send(
      await app.crmService.convertLead(
        id((r.params as { id: unknown }).id),
        body(crmConvertLead, r.body),
        scope(r),
        key(r),
      ),
    ),
  )

  app.get('/v1/crm/catalogs', read, () => app.crmService.catalogs())

  app.post('/v1/crm/prospects', create, async (r, reply) =>
    reply.code(201).send(await app.crmService.createProspect(body(crmCreateProspect, r.body))),
  )

  app.patch('/v1/crm/prospects/:id', update, r =>
    app.crmService.updateProspect(
      id((r.params as { id: unknown }).id),
      body(crmUpdateProspect, r.body),
      scope(r),
    ),
  )

  for (const resource of ['tipos-cliente', 'tipos-servicio', 'referidores'] as const) {
    app.get(`/v1/crm/${resource}`, read, () => app.crmService.catalog(resource).list())

    app.post(`/v1/crm/${resource}`, create, async (r, reply) =>
      reply.code(201).send(
        await app.crmService.catalog(resource).create(body(crmCatalogCreate, r.body).nombre),
      ),
    )

    app.patch(`/v1/crm/${resource}/:id/status`, update, r =>
      app.crmService.catalog(resource).status(
        id((r.params as { id: unknown }).id),
        body(crmCatalogUpdate, r.body).activo,
      ),
    )
  }
}
