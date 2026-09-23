import { badRequest } from '../../http/errors/app-error.js'
import { listEmployeesQuerySchema, type ListEmployeesQuery } from '../../http/schemas/employees.js'
import type { EmployeesRepository } from '../../infrastructure/db/employees-repository.js'

export function parseListEmployeesQuery(query: Record<string, unknown>): ListEmployeesQuery {
  const parsed = listEmployeesQuerySchema.safeParse(query)
  if (!parsed.success) throw badRequest('Invalid query parameters', parsed.error.flatten())
  return parsed.data
}

export function listEmployees(repo: EmployeesRepository, input: ListEmployeesQuery) {
  return repo.list(input)
}
