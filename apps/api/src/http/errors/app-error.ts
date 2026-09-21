export class AppError extends Error {
  /** Fastify reads statusCode on Error instances */
  statusCode: number
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.statusCode = status
    this.code = code
    this.details = details
  }
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError(401, 'unauthorized', message)
}

/** Disabled / banned Auth user — distinct stable code for clients (logout + redirect). */
export function userDisabled(message = 'User is disabled'): AppError {
  return new AppError(401, 'user_disabled', message)
}

/** Access token issued before tokens_valid_after epoch (disable / password change). */
export function sessionInvalidated(message = 'Session invalidated'): AppError {
  return new AppError(401, 'session_invalidated', message)
}

export function forbidden(message = 'Forbidden'): AppError {
  return new AppError(403, 'forbidden', message)
}

/** MFA / AAL insufficient for privileged operation. */
export function mfaRequired(message = 'Multi-factor authentication required'): AppError {
  return new AppError(403, 'mfa_required', message)
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'bad_request', message, details)
}

export function notFound(message = 'Not found'): AppError {
  return new AppError(404, 'not_found', message)
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, 'conflict', message, details)
}

export function serviceUnavailable(message: string): AppError {
  return new AppError(503, 'service_unavailable', message)
}

export function rateLimitExceeded(message = 'Rate limit exceeded'): AppError {
  return new AppError(429, 'rate_limit_exceeded', message)
}
