import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import EmpleadoForm from '@/components/EmpleadoForm'
import EmpleadosTabla from '@/components/EmpleadosTabla'
import { ApiClientError, createDinamicApiClient, type EmployeesResponse, type HrCatalogsResponse } from '@/lib/api/generated'

type Params = { page?: string; search?: string; activo?: string; clienteId?: string }

function isEmployeesResponse(value: unknown): value is EmployeesResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<EmployeesResponse>
  return Array.isArray(candidate.items)
    && candidate.items.every((item) => {
      if (!item || typeof item !== 'object') return false
      const employee = item as { id?: unknown; nombre_apellido?: unknown; asignaciones?: unknown }
      return typeof employee.id === 'string'
        && typeof employee.nombre_apellido === 'string'
        && Array.isArray(employee.asignaciones)
    })
    && typeof candidate.page === 'number'
    && typeof candidate.pageSize === 'number'
    && typeof candidate.total === 'number'
}

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const statusHint = error.status === 401
      ? 'La sesión no es válida o expiró.'
      : error.status === 403
        ? 'Tu usuario no tiene permiso para consultar empleados.'
        : error.status >= 500
          ? 'El backend o la base de datos no están disponibles.'
          : error.message
    const requestHint = error.requestId ? ` (ref: ${error.requestId})` : ''
    return `${statusHint}${requestHint}`
  }
  return 'No se pudo cargar la información de empleados. Verificá la conexión con el backend.'
}

export default async function EmpleadosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const baseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  let data: EmployeesResponse | null = null
  let catalogs: HrCatalogsResponse = { employees: [], clients: [] }
  let loadError: string | null = null

  if (!session?.access_token || !baseUrl) {
    loadError = !session?.access_token
      ? 'La sesión no está disponible o expiró. Volvé a iniciar sesión.'
      : 'La API no está configurada. Contactá a soporte.'
  } else {
    try {
      const api = createDinamicApiClient({ baseUrl, accessToken: session.access_token })
      const [employeesResponse, catalogsResponse] = await Promise.all([
        api.listEmployees({
          page, pageSize: 25,
          ...(params.search?.trim() ? { search: params.search.trim() } : {}),
          ...(params.activo === 'true' || params.activo === 'false' ? { activo: params.activo === 'true' } : {}),
          ...(params.clienteId ? { clienteId: params.clienteId } : {}),
        }),
        api.getHrCatalogs('clients'),
      ])
      if (!isEmployeesResponse(employeesResponse)) {
        throw new Error('Invalid employees API response')
      }
      data = employeesResponse
      catalogs = catalogsResponse
    } catch (error) {
      loadError = loadErrorMessage(error)
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  if (data && !loadError && page > pages) {
    const query = new URLSearchParams()
    if (params.search) query.set('search', params.search)
    if (params.activo) query.set('activo', params.activo)
    if (params.clienteId) query.set('clienteId', params.clienteId)
    if (pages > 1) query.set('page', String(pages))
    redirect(`/empleados${query.size ? `?${query.toString()}` : ''}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Empleados</h1>
      {loadError ? (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
          {loadError}
        </div>
      ) : data ? (
        <>
          <EmpleadoForm />
          <EmpleadosTabla
            empleados={data.items}
            clientes={catalogs.clients}
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            filters={params}
          />
        </>
      ) : null}
    </div>
  )
}
