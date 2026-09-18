import { createClient } from '@/utils/supabase/server'
import EmpleadoForm from '@/components/EmpleadoForm'
import EmpleadosTabla from '@/components/EmpleadosTabla'
import {
  ApiClientError,
  createDinamicApiClient,
  type EmployeeListItem,
} from '@/lib/api/generated'

const MAX_PAGES = 50

async function fetchEmployeesFromApi(accessToken: string): Promise<EmployeeListItem[]> {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!base) {
    throw new ApiClientError('API_URL / NEXT_PUBLIC_API_URL is not configured', 0, null)
  }

  const client = createDinamicApiClient({ baseUrl: base, accessToken })
  const pageSize = 100
  let page = 1
  const all: EmployeeListItem[] = []
  let total = Infinity

  while (all.length < total) {
    if (page > MAX_PAGES) {
      throw new ApiClientError(
        `Se alcanzó el límite operativo de ${MAX_PAGES} páginas. Usá paginación en una fase posterior.`,
        0,
        null,
      )
    }

    try {
      const data = await client.listEmployees({ page, pageSize })
      total = data.total
      all.push(...data.items)
      if (data.items.length === 0) break
      page += 1
    } catch (e) {
      if (e instanceof ApiClientError) {
        console.error('employees_api_failed', {
          status: e.status,
          requestId: e.requestId,
          path: '/v1/employees',
        })
        throw new ApiClientError(
          'No se pudieron cargar los empleados. Reintentá o contactá a soporte.',
          e.status,
          e.requestId,
          e.problem,
        )
      }
      throw e
    }
  }

  return all
}

export default async function EmpleadosPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Empleados</h1>
        <p className="text-rose-600 text-sm">Sesión no disponible. Volvé a iniciar sesión.</p>
      </div>
    )
  }

  let empleados: EmployeeListItem[] = []
  let loadError: string | null = null
  try {
    empleados = await fetchEmployeesFromApi(session.access_token)
  } catch (e) {
    if (e instanceof ApiClientError) {
      loadError = e.requestId
        ? `${e.message} (ref: ${e.requestId})`
        : e.message
    } else {
      console.error('employees_page_unexpected', e)
      loadError = 'No se pudieron cargar los empleados. Reintentá o contactá a soporte.'
    }
  }

  // Clientes still from Supabase for filter dropdown (out of Phase 1 API scope)
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .order('nombre')

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Empleados</h1>

      {loadError ? (
        <p className="text-rose-600 text-sm mb-4">{loadError}</p>
      ) : (
        <p className="text-slate-500 text-xs mb-4">
          Listado servido por API backend ({empleados.length} registros). Altas/estados siguen en Supabase (piloto).
        </p>
      )}

      <EmpleadoForm />

      <EmpleadosTabla empleados={empleados} clientes={clientes ?? []} />
    </div>
  )
}
