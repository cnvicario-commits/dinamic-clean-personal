import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
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
import { assignmentsRoutes } from './http/routes/v1/assignments.js'
import { hrCatalogsRoutes } from './http/routes/v1/hr-catalogs.js'
import { usersRoutes } from './http/routes/v1/users.js'
import { AppError, rateLimitExceeded } from './http/errors/app-error.js'
import { buildProblemBody, isProblemBody, sendProblem, toAppError } from './http/errors/problem-details.js'
import { openApiDocument } from './http/openapi.js'
import { createEmployeesRepository, type EmployeesRepository } from './infrastructure/db/employees-repository.js'
import { createAssignmentsRepository, type AssignmentsRepository } from './infrastructure/db/assignments-repository.js'
import { createHrCatalogsRepository } from './infrastructure/db/hr-catalogs-repository.js'
import { createAttendanceRepository } from './infrastructure/db/attendance-repository.js'
import { createAttendanceService } from './application/attendance/attendance-service.js'
import {
  createAttendanceJustificationsStorage,
  type AttendanceJustificationsStorage,
} from './infrastructure/storage/attendance-justifications-storage.js'
import { createAttendanceJustificationsService } from './application/attendance/attendance-justifications-service.js'
import { createHrReportsRepository } from './infrastructure/db/hr-reports-repository.js'
import { createHrReportsService } from './application/hr-reports/hr-reports-service.js'
import { createClientsRepository, type ClientsRepository } from './infrastructure/db/clients-repository.js'
import { clientsRoutes } from './http/routes/v1/clients.js'
import { createClientQuotesStorage, type ClientQuotesStorage } from './infrastructure/storage/client-quotes-storage.js'
import { createClientQuotesService } from './application/clients/client-quotes-service.js'
import { createClientsService } from './application/clients/clients-service.js'
import { createCatalogRepository, type CatalogRepository } from './infrastructure/db/catalog-repository.js'
import { createCatalogService } from './application/catalog/catalog-service.js'
import { catalogRoutes } from './http/routes/v1/catalog.js'
import { createPurchasesRepository, type PurchasesRepository } from './infrastructure/db/purchases-repository.js'
import { createPurchasesService } from './application/purchases/purchases-service.js'
import { purchasesRoutes } from './http/routes/v1/purchases.js'
import { createResultsRepository, type ResultsRepository } from './infrastructure/db/results-repository.js'
import { createResultsService } from './application/results/results-service.js'
import { resultsRoutes } from './http/routes/v1/results.js'
import { createCrmRepository } from './infrastructure/db/crm-repository.js'
import { createCrmService } from './application/crm/crm-service.js'
import { crmRoutes } from './http/routes/v1/crm.js'
import { createAuditsRepository } from './infrastructure/db/audits-repository.js'
import { createAuditsService } from './application/audits/audits-service.js'
import { auditsRoutes } from './http/routes/v1/audits.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: Db
    jwtVerifier: JwtVerifier
    identityAdmin: IdentityAdmin
    profilesRepo: ProfilesRepository
    employeesRepo: EmployeesRepository
    assignmentsRepo: AssignmentsRepository
    hrCatalogsRepo: ReturnType<typeof createHrCatalogsRepository>
    attendanceRepo: ReturnType<typeof createAttendanceRepository>
    attendanceService: ReturnType<typeof createAttendanceService>
    attendanceJustificationsStorage: AttendanceJustificationsStorage
    attendanceJustificationsService: ReturnType<typeof createAttendanceJustificationsService>
    hrReportsRepo: ReturnType<typeof createHrReportsRepository>
    hrReportsService: ReturnType<typeof createHrReportsService>
    clientsRepo: ClientsRepository
    clientQuotesStorage: ClientQuotesStorage
    clientQuotesService: ReturnType<typeof createClientQuotesService>
    clientsService: ReturnType<typeof createClientsService>
    catalogRepo: CatalogRepository
    catalogService: ReturnType<typeof createCatalogService>
    purchasesRepo: PurchasesRepository
    purchasesService: ReturnType<typeof createPurchasesService>
    resultsRepo: ResultsRepository
    resultsService: ReturnType<typeof createResultsService>
    crmRepo: ReturnType<typeof createCrmRepository>
    crmService: ReturnType<typeof createCrmService>
    auditsRepo: ReturnType<typeof createAuditsRepository>
    auditsService: ReturnType<typeof createAuditsService>
    /**
     * True when IdentityAdmin is wired (Auth Admin key or test inject).
     * ProfilesRepository always uses the DB pool (Phase 2D).
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
  clientsRepo?: ClientsRepository
  clientQuotesStorage?: ClientQuotesStorage
  attendanceRepo?: ReturnType<typeof createAttendanceRepository>
  attendanceJustificationsStorage?: AttendanceJustificationsStorage
  catalogRepo?: CatalogRepository
  purchasesRepo?: PurchasesRepository
  resultsRepo?: ResultsRepository
  crmRepo?: ReturnType<typeof createCrmRepository>
  auditsRepo?: ReturnType<typeof createAuditsRepository>
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
    banAuthUser: unavailable,
    unbanAuthUser: unavailable,
    getAuthUserSecurityState: unavailable,
    invalidateAccessTokens: unavailable,
    listAuthUserSecurityStates: unavailable,
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
    withAdminLifecycleLock: unavailable,
  }
}

export async function buildApp(env: Env, options: BuildAppOptions = {}) {
  assertUsersModuleConfig(env, options)

  // Empty TRUST_PROXY_CIDRS → false (Docker publishes :3001 directly).
  // Non-empty → pass IP/CIDR allowlist only. Never trustProxy: true or hop counts.
  const cidrs = env.TRUST_PROXY_CIDRS
  const trustProxy = cidrs.length === 0 ? false : cidrs

  const app = Fastify({
    trustProxy,
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'DATABASE_URL',
          'SUPABASE_JWT_SECRET',
          'SUPABASE_SERVICE_ROLE_KEY',
          'password',
          'newPassword',
          'token',
          'access_token',
          'refresh_token',
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
  // Profiles use the DB pool only (Phase 2D) — no service-role table client.
  const profilesRepo = options.profilesRepo ?? createProfilesRepository(db)

  // Ready iff Auth Admin is wired (key or inject) and profiles repo is present.
  const usersModuleReady = identityAdmin != null

  app.decorate('identityAdmin', identityAdmin ?? stubIdentityAdmin())
  app.decorate('profilesRepo', profilesRepo ?? stubProfilesRepo())
  app.decorate('employeesRepo', createEmployeesRepository(db))
  app.decorate('assignmentsRepo', createAssignmentsRepository(db))
  app.decorate('hrCatalogsRepo', createHrCatalogsRepository(db))
  app.decorate('attendanceRepo', options.attendanceRepo ?? createAttendanceRepository(db))
  app.decorate('attendanceService', createAttendanceService(app.attendanceRepo))
  app.decorate(
    'attendanceJustificationsStorage',
    options.attendanceJustificationsStorage ?? createAttendanceJustificationsStorage(env),
  )
  app.decorate(
    'attendanceJustificationsService',
    createAttendanceJustificationsService(
      app.attendanceRepo,
      app.attendanceJustificationsStorage,
      (data, message) => app.log.info(data, message),
    ),
  )
  app.decorate('hrReportsRepo', createHrReportsRepository(db))
  app.decorate('hrReportsService', createHrReportsService(app.hrReportsRepo))
  app.decorate('clientsRepo', options.clientsRepo ?? createClientsRepository(db))
  app.decorate('clientQuotesStorage', options.clientQuotesStorage ?? createClientQuotesStorage(env))
  app.decorate('clientQuotesService', createClientQuotesService(app.clientsRepo,app.clientQuotesStorage,(data,message)=>app.log.info(data,message)))
  app.decorate('clientsService',createClientsService(app.clientsRepo,(data,message)=>app.log.info(data,message)))
  app.decorate('catalogRepo',options.catalogRepo??createCatalogRepository(db))
  app.decorate('catalogService',createCatalogService(app.catalogRepo,(data,message)=>app.log.info(data,message)))
  app.decorate('purchasesRepo',options.purchasesRepo??createPurchasesRepository(db))
  app.decorate('purchasesService',createPurchasesService(app.purchasesRepo,(data,message)=>app.log.info(data,message)))
  app.decorate('resultsRepo',options.resultsRepo ?? createResultsRepository(db))
  app.decorate('resultsService',createResultsService(app.resultsRepo,(data,message)=>app.log.info(data,message)))
  app.decorate('crmRepo',options.crmRepo ?? createCrmRepository(db))
  app.decorate('crmService',createCrmService(app.crmRepo))
  app.decorate('auditsRepo',options.auditsRepo ?? createAuditsRepository(db))
  app.decorate('auditsService',createAuditsService(app.auditsRepo))
  app.decorate('db', db)
  app.decorate('jwtVerifier', jwtVerifier)
  app.decorate('usersModuleReady', usersModuleReady)
  app.decorate('config', env)

  // Explicit origin allowlist + credentials. Never wildcard+credentials.
  const origins = env.CORS_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  await app.register(cors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Helmet after CORS. CSP is a browser/document concern (Next/FE); JSON API disables it.
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts:
      env.NODE_ENV === 'production'
        ? { maxAge: 15_552_000, includeSubDomains: false, preload: false }
        : false,
  })

  // Helmet 8 has no permissionsPolicy helper — set explicitly for API responses.
  // Global rate-limit 429s return a plain Problem Details object; ensure problem+json type.
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    reply.header('X-Request-Id', _request.id)
    if (reply.statusCode === 429) {
      reply.type('application/problem+json')
    }
    return payload
  })

  // Must run before encapsulated route plugins so child contexts inherit problem+json.
  // @fastify/rate-limit throws errorResponseBuilder result (plain ProblemBody) — handle that shape.
  app.setErrorHandler((err, request, reply) => {
    if (isProblemBody(err)) {
      request.log.warn({ code: err.code, message: err.detail }, 'request rejected')
      return reply
        .header('X-Request-Id', request.id)
        .status(err.status)
        .type('application/problem+json')
        .send({
          ...err,
          requestId: err.requestId ?? request.id,
        })
    }

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

  if (env.RATE_LIMIT_ENABLED) {
    await app.register(rateLimit, {
      global: true,
      hook: 'onRequest',
      max: env.RATE_LIMIT_GENERAL_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
      keyGenerator: (req) => req.ip,
      errorResponseBuilder: (req, context) =>
        buildProblemBody(
          rateLimitExceeded(`Rate limit exceeded, retry in ${context.after}`),
          req.id,
        ),
      onExceeded: (req) => {
        // Pre-auth IP limiter — never log userId.
        req.log.warn(
          {
            requestId: req.id,
            route: req.routeOptions?.url ?? req.url,
            method: req.method,
            clientKeyType: 'ip',
            result: 'rate_limited',
          },
          'rate limited',
        )
      },
    })
  }

  app.addHook('preHandler', async (request, reply) => {
    try {
      await authenticateRequest(request, {
        db: app.db,
        jwtVerifier: app.jwtVerifier,
        identityAdmin: app.usersModuleReady ? app.identityAdmin : null,
      })
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
  await app.register(assignmentsRoutes)
  await app.register(hrCatalogsRoutes)
  await app.register(clientsRoutes)
  await app.register(catalogRoutes)
  await app.register(purchasesRoutes)
  await app.register(resultsRoutes)
  await app.register(crmRoutes)
  await app.register(auditsRoutes)
  await app.register((await import('./http/routes/v1/attendance.js')).attendanceRoutes)
  await app.register((await import('./http/routes/v1/hr-reports.js')).hrReportsRoutes)
  await app.register(usersRoutes)

  app.get(
    '/openapi.json',
    { config: { rateLimit: false } },
    async () => openApiDocument,
  )

  app.addHook('onClose', async () => {
    await db.close()
  })

  return app
}
