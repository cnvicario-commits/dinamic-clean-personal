/**
 * Per-authenticated-user fixed-window limiter for privileged mutations.
 *
 * SINGLE_INSTANCE_RATE_LIMIT_ONLY — in-memory Map; not shared across replicas.
 * Bound the store so unbounded distinct userIds cannot grow memory without limit.
 */
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import { AppError, unauthorized } from '../errors/app-error.js'

export type SensitiveRateLimitEntry = {
  count: number
  windowStart: number
}

/** Fixed-window counters keyed by `user:<userId>`. Exported so tests can clear. */
export type SensitiveRateLimitStore = Map<string, SensitiveRateLimitEntry>

export const sensitiveRateLimitStore: SensitiveRateLimitStore = new Map()

/** Soft cap on distinct keys (SINGLE_INSTANCE_RATE_LIMIT_ONLY). */
export const SENSITIVE_RATE_LIMIT_MAX_ENTRIES = 10_000

export function clearSensitiveRateLimitStore(
  store: SensitiveRateLimitStore = sensitiveRateLimitStore,
): void {
  store.clear()
}

function pruneSensitiveStore(
  store: SensitiveRateLimitStore,
  windowMs: number,
  now: number,
): void {
  if (store.size <= SENSITIVE_RATE_LIMIT_MAX_ENTRIES) return

  for (const [key, entry] of store) {
    if (store.size <= SENSITIVE_RATE_LIMIT_MAX_ENTRIES) return
    if (now - entry.windowStart >= windowMs) {
      store.delete(key)
    }
  }

  for (const key of store.keys()) {
    if (store.size <= SENSITIVE_RATE_LIMIT_MAX_ENTRIES) return
    store.delete(key)
  }
}

export type SensitiveRateLimitOptions = {
  max: number
  windowMs: number
  store?: SensitiveRateLimitStore
  /** Injectable clock for offline tests. */
  now?: () => number
}

/**
 * Per-authenticated-user fixed-window limiter for privileged mutations.
 * Must run after auth has populated `request.auth` (global authenticateRequest).
 */
export function createSensitiveRateLimitPreHandler(
  opts: SensitiveRateLimitOptions,
): preHandlerAsyncHookHandler {
  const store = opts.store ?? sensitiveRateLimitStore
  const now = opts.now ?? (() => Date.now())

  return async function sensitiveRateLimitPreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.auth) {
      throw unauthorized()
    }

    const key = `user:${request.auth.userId}`
    const t = now()
    let entry = store.get(key)
    if (!entry || t - entry.windowStart >= opts.windowMs) {
      entry = { count: 0, windowStart: t }
      store.set(key, entry)
      pruneSensitiveStore(store, opts.windowMs, t)
    }

    entry.count += 1

    if (entry.count > opts.max) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((entry.windowStart + opts.windowMs - t) / 1000),
      )
      reply.header('Retry-After', String(retryAfterSec))
      request.log.warn(
        {
          requestId: request.id,
          route: request.routeOptions?.url ?? request.url,
          method: request.method,
          clientKeyType: 'userId',
          userId: request.auth.userId,
          result: 'rate_limited',
        },
        'rate limited',
      )
      throw new AppError(429, 'rate_limit_exceeded', 'Rate limit exceeded')
    }
  }
}
