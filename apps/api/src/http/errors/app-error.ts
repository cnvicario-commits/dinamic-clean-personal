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

export function forbidden(message = 'Forbidden'): AppError {
  return new AppError(403, 'forbidden', message)
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'bad_request', message, details)
}

export function notFound(message = 'Not found'): AppError {
  return new AppError(404, 'not_found', message)
}

export function serviceUnavailable(message: string): AppError {
  return new AppError(503, 'service_unavailable', message)
}
