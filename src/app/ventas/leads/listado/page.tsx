import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import ListadoLeadsTabla from '@/components/ListadoLeadsTabla'
import CrmPagination from '@/components/CrmPagination'

export default async function ListadoLeadsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number((await searchParams).page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const api = await createAuthenticatedServerApiClient()
  const [leads, catalogs] = await Promise.all([
    api.listCrmLeads({ page, pageSize: 50 }),
    api.getCrmCatalogs(),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/ventas/leads" className="text-teal-600 hover:underline text-sm mb-4 inline-block">← Volver al tablero</Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Listado de leads</h1>
      <ListadoLeadsTabla leads={leads.items} responsables={catalogs.responsables} />
      <CrmPagination path="/ventas/leads/listado" page={leads.page} pageSize={leads.pageSize} total={leads.total} />
    </div>
  )
}
