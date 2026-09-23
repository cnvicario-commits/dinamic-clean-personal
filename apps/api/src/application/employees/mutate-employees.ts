import { badRequest } from '../../http/errors/app-error.js'
import {
  createEmployeeBodySchema,
  employeeIdParamsSchema,
  updateEmployeeStatusBodySchema,
} from '../../http/schemas/employees.js'
import type { EmployeesRepository } from '../../infrastructure/db/employees-repository.js'

export function parseCreateEmployeeBody(body: unknown) {
  const parsed = createEmployeeBodySchema.safeParse(body)
  if (!parsed.success) throw badRequest('Invalid employee payload', parsed.error.flatten())
  return parsed.data
}

export function parseUpdateEmployeeStatus(id: unknown, body: unknown) {
  const params = employeeIdParamsSchema.safeParse({ id })
  const payload = updateEmployeeStatusBodySchema.safeParse(body)
  if (!params.success) throw badRequest('Invalid employee id', params.error.flatten())
  if (!payload.success) throw badRequest('Invalid employee status payload', payload.error.flatten())
  return { id: params.data.id, activo: payload.data.activo }
}

export function createEmployee(repo: EmployeesRepository, body: unknown) {
  return repo.create(parseCreateEmployeeBody(body))
}
export function updateEmployeeStatus(repo: EmployeesRepository, id: unknown, body: unknown) {
  const input = parseUpdateEmployeeStatus(id, body)
  return repo.setStatus(input.id, input.activo)
}
