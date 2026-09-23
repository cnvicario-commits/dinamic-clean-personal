import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import AsignacionForm from '@/components/AsignacionForm'
import CerrarAsignacionBoton from '@/components/CerrarAsignacionBoton'
import { ApiClientError, createDinamicApiClient, type AssignmentsResponse, type HrCatalogsResponse } from '@/lib/api/generated'

export default async function AsignacionesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? '1', 10) || 1)
  const baseUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  let data: AssignmentsResponse = { items: [], page, pageSize: 25, total: 0 }
  let catalogs: HrCatalogsResponse = { employees: [], clients: [] }
  let error: string | null = null
  if (!session?.access_token || !baseUrl) error = 'Sesión o API no disponible.'
  else {
    try {
      const api = createDinamicApiClient({ baseUrl, accessToken: session.access_token })
      ;[data, catalogs] = await Promise.all([api.listAssignments({ page, pageSize: 25 }), api.getHrCatalogs('employees,clients')])
    } catch (cause) {
      error = cause instanceof ApiClientError ? cause.message : 'No se pudieron cargar las asignaciones.'
    }
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  if (!error && page > pages) redirect(pages > 1 ? `/asignaciones?page=${pages}` : '/asignaciones')
  return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
    <h1 className="text-2xl font-bold text-slate-900 mb-6">Asignaciones</h1>
    {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 mb-8">
      <AsignacionForm empleados={catalogs.employees} clientes={catalogs.clients} />
    </div>
    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Listado ({data.total})</h2>
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]"><thead><tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
        <th className="px-4 py-3 font-medium">Empleado</th><th className="px-4 py-3 font-medium">Cliente</th>
        <th className="px-4 py-3 font-medium">Desde</th><th className="px-4 py-3 font-medium">Hasta</th><th className="px-4 py-3 font-medium"></th>
      </tr></thead><tbody>{data.items.map((assignment) => <tr key={assignment.id} className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-3 text-slate-800">{assignment.empleado_nombre}</td><td className="px-4 py-3 text-slate-800">{assignment.cliente_nombre}</td>
        <td className="px-4 py-3 text-slate-600">{assignment.fecha_desde}</td><td className="px-4 py-3 text-slate-600">{assignment.fecha_hasta ?? 'Actual'}</td>
        <td className="px-4 py-3">{!assignment.fecha_hasta && <CerrarAsignacionBoton id={assignment.id} />}</td>
      </tr>)}</tbody></table>
    </div>
    {data.items.length === 0 && <p className="text-slate-500 text-sm mt-3">No hay asignaciones cargadas todavía.</p>}
    {pages > 1 && <div className="flex justify-end gap-3 mt-4 text-sm">
      {page > 1 ? <Link href={`/asignaciones?page=${page - 1}`}>Anterior</Link> : <span className="text-slate-400">Anterior</span>}
      <span>Página {page} de {pages}</span>
      {page < pages ? <Link href={`/asignaciones?page=${page + 1}`}>Siguiente</Link> : <span className="text-slate-400">Siguiente</span>}
    </div>}
  </div>
}
