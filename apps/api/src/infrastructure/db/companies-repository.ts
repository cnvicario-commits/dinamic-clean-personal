import type { Db } from './pool.js'
import { AppError, conflict, notFound, serviceUnavailable } from '../../http/errors/app-error.js'
import type { Company, CompanyBody, UpdateCompanyBody } from '../../http/schemas/companies.js'

const FIELDS = 'id, nombre, cuit, domicilio, activo'

function postgresCode(error: unknown): string | null {
  if (error === null || typeof error !== 'object' || !('code' in error)) return null
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : null
}

/**
 * empresas has no incoming foreign key and no check constraint.
 * nombre/cuit are validated before the write. 23505 is the only
 * user-correctable SQLSTATE this table can raise today.
 * Any other SQLSTATE, including an internal NOT NULL miss, stays a 500.
 */
function persistenceError(error: unknown): AppError {
  if (error instanceof AppError) return error
  const code = postgresCode(error)
  if (code === '23505') return conflict('A company with this data already exists')
  if (code?.startsWith('08')) return serviceUnavailable('Database connection failed')
  throw error
}

export type CompaniesRepository = ReturnType<typeof createCompaniesRepository>

export function createCompaniesRepository(db: Db) {
  return {
    async create(input: CompanyBody): Promise<Company> {
      try {
        const result = await db.query<Company>(
          `insert into public.empresas (nombre, cuit, domicilio, activo)
           values ($1, $2, $3, true)
           returning ${FIELDS}`,
          [input.nombre, input.cuit, input.domicilio],
        )
        const row = result.rows[0]
        if (!row) throw new AppError(502, 'company_create_empty', 'Company persistence failed')
        return row
      } catch (error) {
        throw persistenceError(error)
      }
    },

    async update(id: string, input: UpdateCompanyBody): Promise<Company> {
      try {
        const result = await db.query<Company>(
          `update public.empresas
           set nombre = case when $2::boolean then $3 else nombre end,
               cuit = case when $4::boolean then $5 else cuit end,
               domicilio = case when $6::boolean then $7 else domicilio end
           where id = $1
           returning ${FIELDS}`,
          [
            id,
            input.nombre !== undefined,
            input.nombre ?? null,
            input.cuit !== undefined,
            input.cuit ?? null,
            input.domicilio !== undefined,
            input.domicilio ?? null,
          ],
        )
        const row = result.rows[0]
        if (!row) throw notFound('Company not found')
        return row
      } catch (error) {
        throw persistenceError(error)
      }
    },

    async setStatus(id: string, activo: boolean): Promise<Company> {
      try {
        const result = await db.query<Company>(
          `update public.empresas
           set activo = $2
           where id = $1
           returning ${FIELDS}`,
          [id, activo],
        )
        const row = result.rows[0]
        if (!row) throw notFound('Company not found')
        return row
      } catch (error) {
        throw persistenceError(error)
      }
    },
  }
}
