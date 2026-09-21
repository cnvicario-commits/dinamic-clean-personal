import Fastify from 'fastify'
import cors from '@fastify/cors'
import type { Env } from './config/env.js'
import { createDb, type Db } from './infrastructure/db/pool.js'
import { createJwtVerifier, type JwtVerifier } from './infrastructure/auth/jwt.js'
import {
  createIdentityAdmin,
  type IdentityAdmin,
} from './infrastructure/auth/identity-admin.js'
import {
  createProfilesRepository,
  type ProfilesRepository,
} from './infrastructure/db/profiles-repository.js'
import { authenticateRequest } from './http/plugins/auth.js'
import { healthRoutes } from './http/routes/health.js'
import { meRoutes } from './http/routes/v1/me.js'
import { employeesRoutes } from './http/routes/v1/employees.js'
import { usersRoutes } from './http/routes/v1/users.js'
import { AppError } from './http/errors/app-error.js'
import { sendProblem, toAppError } from './http/errors/problem-details.js'
import { openApiDocument } from './http/openapi.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
    jwtVerifier: JwtVerifier
    identityAdmin: IdentityAdmin
    profilesRepo: ProfilesRepository
    /**
     * True only when both IdentityAdmin and ProfilesRepository are wired
     * (config key or test injects). Never true for stubs.
     */
    usersModuleReady: boolean
    config: Env
  }
}

export type BuildAppOptions = {
  db?: Db
  jwtVerifier?: JwtVerifier
  /** Test inject — when both identity + profiles are provided, module is ready. */
  identityAdmin?: IdentityAdmin
  profilesRepo?: ProfilesRepository
}

/**
 * Production must not start without SERVICE_ROLE_KEY (users module dependency).
 */
export function assertUsersModuleConfig(env: Env, options: BuildAppOptions): void {
  if (
    env.NODE_ENV === 'production' &&
    !(options.identityAdmin && options.profilesRepo) &&
    !env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      'Invalid configuration: SUPABASE_SERVICE_ROLE_KEY is required in production for the users module',
    )
  }
}

function stubIdentityAdmin(): IdentityAdmin {
  const unavailable = () => {
    throw new AppError(503, 'service_unavailable', 'Identity dependency unavailable')
  }
  return {
    createAuthUser: unavailable,
    deleteAuthUser: unavailable,
    setAuthPassword: unavailable,
    listAuthEmails: unavailable,
  }
}

function stubProfilesRepo(): ProfilesRepository {
  const unavailable = () => {
    throw new AppError(503, 'service_unavailable', 'Identity dependency unavailable')
  }
  return {
    list: unavailable,
    getById: unavailable,
    updateNombreCompleto: unavailable,
    upsert: unavailable,
    updateRole: unavailable,
  }
}

export async function buildApp(env: Env, options: BuildAppOptions = {}) {
  assertUsersModuleConfig(env, options)

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'DATABASE_URL',
          'SUPABASE_JWT_SECRET',
          'SUPABASE_SERVICE_ROLE_KEY',
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

  const hasKey = Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
  const identityAdmin =
    options.identityAdmin ?? (hasKey ? createIdentityAdmin(env) : null)
  const profilesRepo =
    options.profilesRepo ?? (hasKey ? createProfilesRepository(env, db) : null)

  // Ready iff both deps are real (injected or constructed) — never when using stubs.
  const usersModuleReady = identityAdmin != null && profilesRepo != null

  app.decorate('identityAdmin', identityAdmin ?? stubIdentityAdmin())
  app.decorate('profilesRepo', profilesRepo ?? stubProfilesRepo())
  app.decorate('db', db)
  app.decorate('jwtVerifier', jwtVerifier)
  app.decorate('usersModuleReady', usersModuleReady)
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
  await app.register(usersRoutes)

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

    if (appErr.code === 'user_create_orphan') {
      request.log.error(
        {
          code: appErr.code,
          requestId: request.id,
          details: appErr.details,
        },
        'user create orphan — reconcile Auth user',
      )
    } else if (appErr.status >= 500) {
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
