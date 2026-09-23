import type { FastifyPluginAsync } from 'fastify'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/healthz', { config: { rateLimit: false } }, async () => ({ status: 'ok' }))

  app.get('/readyz', { config: { rateLimit: false } }, async (_request, reply) => {
    try {
      const dbOk = await app.db.isReady()
      if (!dbOk) {
        return reply.code(503).send({ status: 'not_ready', reason: 'database' })
      }
      if (!app.usersModuleReady) {
        return reply
          .code(503)
          .send({ status: 'not_ready', reason: 'users_module_dependency' })
      }
      const phase2d = await app.db.checkPhase2dProfilesCapabilities()
      if (!phase2d.ok) {
        return reply.code(503).send({
          status: 'not_ready',
          reason: 'phase2d_schema_incompatible',
          detail: phase2d.reason,
        })
      }
      const phase3a = await app.db.checkPhase3aCapabilities()
      if (!phase3a.ok) {
        _request.log.error({ reason: phase3a.reason }, 'db_schema_incompatible')
        return reply.code(503).send({
          status: 'not_ready',
          reason: 'db_schema_incompatible',
          detail: phase3a.reason,
        })
      }
      return { status: 'ready' }
    } catch (error) {
      _request.log.error({ err: error }, 'readiness_probe_failed')
      return reply.code(503).send({ status: 'not_ready' })
    }
  })
}
