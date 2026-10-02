import type { FastifyRequest } from 'fastify'
import type { ZodType } from 'zod'
import { badRequest } from './errors/app-error.js'

function exceedsImportLimit(issues: { code: string }[]) {
  return issues.some((issue) => issue.code === 'too_big')
}

/** Parse import bodies and emit structured logs when shared row/order caps reject the payload. */
export function parseImportPayload<T>(
  req: FastifyRequest,
  schema: ZodType<T>,
  operation: string,
  invalidMessage: string,
): T {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    if (exceedsImportLimit(parsed.error.issues)) {
      req.log.warn(
        {
          requestId: req.id,
          operation,
          reason: 'import_limit',
          result: 'rejected',
        },
        'import payload rejected by limit',
      )
    }
    throw badRequest(invalidMessage, parsed.error.flatten())
  }
  return parsed.data
}
