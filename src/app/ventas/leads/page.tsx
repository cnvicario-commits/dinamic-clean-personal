import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import TableroLeads from '@/components/TableroLeads'
import CrmPagination from '@/components/CrmPagination'

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number((await searchParams).page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const api = await createAuthenticatedServerApiClient()
  const [leads, catalogs] = await Promise.all([
    api.listCrmLeads({ page, pageSize: 100 }),
    api.getCrmCatalogs(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Leads</h1>
      <TableroLeads leads={leads.items} responsables={catalogs.responsables} />
      <CrmPagination path="/ventas/leads" page={leads.page} pageSize={leads.pageSize} total={leads.total} />
    </div>
  )
}
