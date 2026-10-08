import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import ListadoLeadsTabla from '@/components/ListadoLeadsTabla'
import CrmPagination from '@/components/CrmPagination'
import { ESTADOS_LEAD } from '@/components/TableroLeads'
import type { CrmLeadState } from '@/lib/api/generated'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function pageOf(raw?: string) {
  const value = Number(raw ?? '1')
  return Number.isInteger(value) && value > 0 ? value : 1
}

function estadoOf(raw?: string): CrmLeadState | undefined {
  return ESTADOS_LEAD.some((item) => item.valor === raw) ? (raw as CrmLeadState) : undefined
}

export default async function ListadoLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; estado?: string; responsableId?: string; search?: string }>
}) {
  const query = await searchParams
  const page = pageOf(query.page)
  const estado = estadoOf(query.estado)
  const search = query.search?.trim().slice(0, 100) || undefined
  const api = await createAuthenticatedServerApiClient()
  const me = await api.getMe()
  const global = me.role === 'admin' || me.role === 'gerente'
  const responsableId = global && query.responsableId && UUID.test(query.responsableId) ? query.responsableId : undefined
  const [leads, catalogs] = await Promise.all([
    api.listCrmLeads({ page, pageSize: 50, estado, responsableId, search }),
    global ? api.getCrmCatalogs() : Promise.resolve(null),
  ])
  const filtros = { estado, responsableId, search }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/ventas/leads" className="text-teal-600 hover:underline text-sm mb-4 inline-block">← Volver al tablero</Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Listado de leads</h1>
      <form className="flex flex-wrap gap-2 mb-4" action="/ventas/leads/listado">
        <input name="search" defaultValue={search ?? ''} placeholder="Buscar cliente" className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
        <select name="estado" defaultValue={estado ?? ''} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {ESTADOS_LEAD.map((item) => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}
        </select>
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
      <ListadoLeadsTabla leads={leads.items} />
      <CrmPagination path="/ventas/leads/listado" page={leads.page} pageSize={leads.pageSize} total={leads.total} query={filtros} />
    </div>
  )
}
