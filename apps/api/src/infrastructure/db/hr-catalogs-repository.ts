import type { Db } from './pool.js'
import type { HrCatalogsResponse } from '../../http/schemas/hr-catalogs.js'
import type { HrCatalogsQuery } from '../../http/schemas/hr-catalogs.js'

export function createHrCatalogsRepository(db: Db) {
  return {
    async list(input: HrCatalogsQuery): Promise<HrCatalogsResponse> {
      const include = new Set(input.include)
      const [employees, clients] = await Promise.all([
        include.has('employees') ? db.query<{ id: string; nombre_apellido: string }>(
          `select id, nombre_apellido
           from public.empleados
           order by nombre_apellido asc, id asc`,
        ) : Promise.resolve({ rows: [] }),
        include.has('clients') ? db.query<{ id: string; nombre: string }>(
          `select id, nombre
           from public.clientes
           order by nombre asc, id asc`,
        ) : Promise.resolve({ rows: [] }),
      ])
      return { employees: employees.rows, clients: clients.rows }
    },
  }
}
