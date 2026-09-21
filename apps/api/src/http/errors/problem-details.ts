import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from './app-error.js'

export type ProblemBody = {
  type: string
  title: string
  status: number
  detail: string
  code: string
  requestId?: string
  details?: unknown
}

export function isProblemBody(value: unknown): value is ProblemBody {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    typeof v.title === 'string' &&
    typeof v.status === 'number' &&
    typeof v.detail === 'string' &&
    typeof v.code === 'string'
  )
}

export function buildProblemBody(error: AppError, requestId?: string): ProblemBody {
  const body: ProblemBody = {
    type: `about:blank`,
    title: error.code,
    status: error.status,
    detail: error.message,
    code: error.code,
  }
  if (requestId !== undefined) {
    body.requestId = requestId
  }
  if (error.details !== undefined) {
    body.details = error.details
  }
  return body
}

export function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  error: AppError,
): FastifyReply {
  const body = buildProblemBody(error, request.id)
  return reply
    .header('X-Request-Id', request.id)
    .status(error.status)
    .type('application/problem+json')
    .send(body)
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  return new AppError(500, 'internal_error', 'Internal Server Error')
}
