import { AppError, badRequest, conflict, serviceUnavailable } from '../../http/errors/app-error.js'

/**
 * Maps constraint failures for a repository that knows the statement can fail
 * because of caller input. Does not read driver message, detail, query, or stack.
 * Connection failures (`08xxx`) are included so that write path still returns 503
 * instead of a persistence 502. Returns null for AppError and unrecognized errors.
 */
export function mapPostgresError(error: unknown): AppError | null {
  if (error instanceof AppError) return null
  const code = postgresCode(error)
  if (!code) return null
  if (code === '23505') return conflict('The record conflicts with an existing unique value')
  if (code === '23503') return badRequest('Related record does not exist')
  if (code === '23502') return badRequest('A required value is missing')
  if (code === '23514') return badRequest('The value violates a database constraint')
  if (code === '22P02') return badRequest('A value has an invalid format')
  if (code.startsWith('08')) return serviceUnavailable('Database connection failed')
  return null
}

/**
 * Global safety net. Only connection failures are safe to classify without
 * knowing the statement. A NOT NULL or foreign key from an internal column
 * must stay a 500 so a programming bug is not reported as a client error.
 */
export function mapUnhandledPostgresError(error: unknown): AppError | null {
  if (error instanceof AppError) return null
  const code = postgresCode(error)
  if (code?.startsWith('08')) return serviceUnavailable('Database connection failed')
  return null
}

/** Domain AppError wins. Recognized PostgreSQL errors become AppError. Anything else is rethrown unchanged. */
export function rethrowPostgresError(error: unknown): never {
  if (error instanceof AppError) throw error
  const mapped = mapPostgresError(error)
  if (mapped) throw mapped
  throw error
}

function postgresCode(error: unknown): string | null {
  if (error === null || typeof error !== 'object' || !('code' in error)) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : null
}
