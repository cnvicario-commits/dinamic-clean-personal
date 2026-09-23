import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import EmpleadoForm from '@/components/EmpleadoForm'
import EmpleadosTabla from '@/components/EmpleadosTabla'
import { ApiClientError, createDinamicApiClient, type EmployeesResponse, type HrCatalogsResponse } from '@/lib/api/generated'

type Params = { page?: string; search?: string; activo?: string; clienteId?: string }

export default async function EmpleadosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const params = await searchParams
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1)
  const baseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  let data: EmployeesResponse = { items: [], page, pageSize: 25, total: 0 }
  let catalogs: HrCatalogsResponse = { employees: [], clients: [] }
  let loadError: string | null = null

  if (!session?.access_token || !baseUrl) {
    loadError = 'Sesión o API no disponible. Volvé a iniciar sesión.'
  } else {
    try {
      const api = createDinamicApiClient({ baseUrl, accessToken: session.access_token })
      ;[data, catalogs] = await Promise.all([
        api.listEmployees({
          page, pageSize: 25,
          ...(params.search?.trim() ? { search: params.search.trim() } : {}),
          ...(params.activo === 'true' || params.activo === 'false' ? { activo: params.activo === 'true' } : {}),
          ...(params.clienteId ? { clienteId: params.clienteId } : {}),
        }),
        api.getHrCatalogs('clients'),
      ])
    } catch (error) {
      loadError = error instanceof ApiClientError && error.requestId
        ? `${error.message} (ref: ${error.requestId})`
        : 'No se pudieron cargar los empleados.'
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  if (!loadError && page > pages) {
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
      {loadError && <p className="text-rose-600 text-sm mb-4">{loadError}</p>}
      <EmpleadoForm />
      <EmpleadosTabla
        empleados={data.items}
        clientes={catalogs.clients}
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        filters={params}
      />
    </div>
  )
}
