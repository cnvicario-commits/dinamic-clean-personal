import { badRequest } from '../../http/errors/app-error.js'
import {
  assignmentIdParamsSchema,
  createAssignmentBodySchema,
  listAssignmentsQuerySchema,
} from '../../http/schemas/assignments.js'
import type { AssignmentsRepository } from '../../infrastructure/db/assignments-repository.js'

export function parseListAssignmentsQuery(query: Record<string, unknown>) {
  const parsed = listAssignmentsQuerySchema.safeParse(query)
  if (!parsed.success) throw badRequest('Invalid query parameters', parsed.error.flatten())
  return parsed.data
}
export function parseCreateAssignmentBody(body: unknown) {
  const parsed = createAssignmentBodySchema.safeParse(body)
  if (!parsed.success) throw badRequest('Invalid assignment payload', parsed.error.flatten())
  return parsed.data
}
export function parseAssignmentId(id: unknown) {
  const parsed = assignmentIdParamsSchema.safeParse({ id })
  if (!parsed.success) throw badRequest('Invalid assignment id', parsed.error.flatten())
  return parsed.data.id
}
export function listAssignments(repo: AssignmentsRepository, query: Record<string, unknown>) {
  return repo.list(parseListAssignmentsQuery(query))
}
export function createAssignment(repo: AssignmentsRepository, body: unknown) {
  return repo.create(parseCreateAssignmentBody(body))
}
export function closeAssignment(repo: AssignmentsRepository, id: unknown) {
  return repo.close(parseAssignmentId(id))
}
