import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import TableroLeads from '@/components/TableroLeads'
import CrmPagination from '@/components/CrmPagination'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function pageOf(raw?: string) {
  const value = Number(raw ?? '1')
  return Number.isInteger(value) && value > 0 ? value : 1
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; responsableId?: string; search?: string }>
}) {
  const query = await searchParams
  const page = pageOf(query.page)
  const search = query.search?.trim().slice(0, 100) || undefined
  const api = await createAuthenticatedServerApiClient()
  const me = await api.getMe()
  const global = me.role === 'admin' || me.role === 'gerente'
  const responsableId = global && query.responsableId && UUID.test(query.responsableId) ? query.responsableId : undefined
  const [leads, catalogs] = await Promise.all([
    api.listCrmLeads({ page, pageSize: 100, responsableId, search }),
    global ? api.getCrmCatalogs() : Promise.resolve(null),
  ])
  const filtros = { responsableId, search }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Leads</h1>
      <form className="flex flex-wrap gap-2 mb-5" action="/ventas/leads">
        <input name="search" defaultValue={search ?? ''} placeholder="Buscar cliente" className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
        {global && catalogs && (
          <select name="responsableId" defaultValue={responsableId ?? ''} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
            <option value="">Todos los responsables</option>
            {catalogs.responsables.map((responsable) => (
              <option key={responsable.id} value={responsable.id}>{responsable.nombre_completo}</option>
            ))}
          </select>
        )}
        <button type="submit" className="rounded bg-teal-600 px-3 py-2 text-sm font-medium text-white">Filtrar</button>
      </form>
      <TableroLeads leads={leads.items} />
      <CrmPagination path="/ventas/leads" page={leads.page} pageSize={leads.pageSize} total={leads.total} query={filtros} />
    </div>
  )
}
