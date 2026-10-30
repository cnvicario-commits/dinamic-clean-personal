import { AppError, badRequest, conflict, serviceUnavailable } from '../../http/errors/app-error.js'

/**
 * Maps user-correctable PostgreSQL errors to HTTP 4xx and connection failures to 503.
 * Does not read driver message, detail, query, or stack.
 * Returns null for AppError and for errors this module does not recognize.
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
