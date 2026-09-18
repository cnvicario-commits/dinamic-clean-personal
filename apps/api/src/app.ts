import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { Env } from './config/env.js'
import { createDb, type Db } from './infrastructure/db/pool.js'
import { createJwtVerifier, type JwtVerifier } from './infrastructure/auth/jwt.js'
import { authenticateRequest } from './http/plugins/auth.js'
import { healthRoutes } from './http/routes/health.js'
import { meRoutes } from './http/routes/v1/me.js'
import { employeesRoutes } from './http/routes/v1/employees.js'
import { AppError } from './http/errors/app-error.js'
import { sendProblem, toAppError } from './http/errors/problem-details.js'
import { openApiDocument } from './http/openapi.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
    jwtVerifier: JwtVerifier
    config: Env
  }
}

export type BuildAppOptions = {
  /** Inject for tests (mock readiness / profile queries). */
  db?: Db
  jwtVerifier?: JwtVerifier
}

export async function buildApp(env: Env, options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'DATABASE_URL',
          'SUPABASE_JWT_SECRET',
          'password',
          'token',
        ],
        remove: true,
      },
    },
    genReqId: () => crypto.randomUUID(),
    requestTimeout: 30_000,
    bodyLimit: 1_048_576,
  })

  const db = options.db ?? createDb(env)
  const jwtVerifier = options.jwtVerifier ?? createJwtVerifier(env)

  app.decorate('db', db)
  app.decorate('jwtVerifier', jwtVerifier)
  app.decorate('config', env)

  const origins = env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  await app.register(cors, {
    origin: origins,
    credentials: true,
  })

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Request-Id', request.id)
    return payload
  })

  app.addHook('preHandler', async (request, reply) => {
    try {
      await authenticateRequest(request, app.db, app.jwtVerifier)
    } catch (err) {
      if (err instanceof AppError) {
        return sendProblem(reply, request, err)
      }
      throw err
    }
  })

  await app.register(healthRoutes)
  await app.register(meRoutes)
  await app.register(employeesRoutes)

  app.get('/openapi.json', async () => openApiDocument)

  app.setErrorHandler((err, request, reply) => {
    const appErr =
      err instanceof AppError
        ? err
        : typeof (err as { statusCode?: number }).statusCode === 'number' &&
            (err as { statusCode: number }).statusCode < 500 &&
            typeof (err as Error).message === 'string'
          ? new AppError(
              (err as { statusCode: number }).statusCode,
              typeof (err as { code?: string }).code === 'string'
                ? (err as { code: string }).code
                : 'request_error',
              (err as Error).message,
            )
          : toAppError(err)

    if (appErr.status >= 500) {
      request.log.error({ err }, 'request failed')
    } else {
      request.log.warn({ code: appErr.code, message: appErr.message }, 'request rejected')
    }
    return sendProblem(reply, request, appErr)
  })

  app.addHook('onClose', async () => {
    await db.close()
  })

  return app
}
