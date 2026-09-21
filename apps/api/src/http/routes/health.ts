import type { FastifyPluginAsync } from 'fastify'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/healthz', async () => ({ status: 'ok' }))

  app.get('/readyz', async (_request, reply) => {
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
      return { status: 'ready' }
    } catch {
      return reply.code(503).send({ status: 'not_ready' })
    }
  })
}
