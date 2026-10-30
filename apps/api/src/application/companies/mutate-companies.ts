import { badRequest } from '../../http/errors/app-error.js'
import {
  companyBodySchema,
  companyIdParamsSchema,
  updateCompanyStatusBodySchema,
} from '../../http/schemas/companies.js'
import type { CompaniesRepository } from '../../infrastructure/db/companies-repository.js'

export function createCompany(repo: CompaniesRepository, body: unknown) {
  const parsed = companyBodySchema.safeParse(body)
  if (!parsed.success) throw badRequest('Invalid company payload', parsed.error.flatten())
  return repo.create(parsed.data)
}

export function updateCompany(repo: CompaniesRepository, id: unknown, body: unknown) {
  const params = companyIdParamsSchema.safeParse({ id })
  const parsed = companyBodySchema.safeParse(body)
  if (!params.success) throw badRequest('Invalid company id', params.error.flatten())
  if (!parsed.success) throw badRequest('Invalid company payload', parsed.error.flatten())
  return repo.update(params.data.id, parsed.data)
}

export function updateCompanyStatus(repo: CompaniesRepository, id: unknown, body: unknown) {
  const params = companyIdParamsSchema.safeParse({ id })
  const parsed = updateCompanyStatusBodySchema.safeParse(body)
  if (!params.success) throw badRequest('Invalid company id', params.error.flatten())
  if (!parsed.success) throw badRequest('Invalid company status payload', parsed.error.flatten())
  return repo.setStatus(params.data.id, parsed.data.activo)
}
