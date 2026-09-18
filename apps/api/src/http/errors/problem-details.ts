import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from './app-error.js'

type ProblemBody = {
  type: string
  title: string
  status: number
  detail: string
  code: string
  requestId?: string
  details?: unknown
}

export function sendProblem(
  reply: FastifyReply,
  request: FastifyRequest,
  error: AppError,
): FastifyReply {
  const body: ProblemBody = {
    type: `about:blank`,
    title: error.code,
    status: error.status,
    detail: error.message,
    code: error.code,
    requestId: request.id,
  }
  if (error.details !== undefined) {
    body.details = error.details
  }
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
