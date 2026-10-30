import { badRequest } from '../../http/errors/app-error.js'
import { idempotencyKeySchema } from '../../http/schemas/clients.js'
import {
  companyBodySchema,
  companyIdParamsSchema,
  updateCompanyBodySchema,
  updateCompanyStatusBodySchema,
} from '../../http/schemas/companies.js'
import type { CompaniesRepository } from '../../infrastructure/db/companies-repository.js'

export function createCompany(
  repo: CompaniesRepository,
  body: unknown,
  actorId: string,
  idempotencyKey: unknown,
) {
  const parsed = companyBodySchema.safeParse(body)
  if (!parsed.success) throw badRequest('Invalid company payload', parsed.error.flatten())
  const key = idempotencyKeySchema.safeParse(idempotencyKey)
  if (!key.success) throw badRequest('Idempotency-Key header is required')
  return repo.create(parsed.data, { actorId, key: key.data })
}

export function updateCompany(repo: CompaniesRepository, id: unknown, body: unknown) {
  const params = companyIdParamsSchema.safeParse({ id })
  const parsed = updateCompanyBodySchema.safeParse(body)
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
