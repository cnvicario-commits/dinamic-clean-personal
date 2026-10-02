import type { FastifyRequest } from 'fastify'
import type { ZodType } from 'zod'
import type { $ZodIssue } from 'zod/v4/core'
import { badRequest } from './errors/app-error.js'

/** Zod `too_big` on shared import volume caps (rows / orders / line items), not field `.max()` strings. */
export function isStructuralImportVolumeLimitIssue(issue: $ZodIssue): boolean {
  if (issue.code !== 'too_big') return false
  const path = issue.path
  if (path.length === 1 && path[0] === 'rows') return true
  if (path.length === 1 && path[0] === 'orders') return true
  if (path.length === 3 && path[0] === 'orders' && path[2] === 'items') return true
  return false
}

function exceedsImportLimit(issues: $ZodIssue[]) {
  return issues.some(isStructuralImportVolumeLimitIssue)
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
