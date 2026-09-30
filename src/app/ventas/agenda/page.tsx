import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import AgendaVentas from '@/components/AgendaVentas'
import CrmPagination from '@/components/CrmPagination'
import type { OportunidadVista } from '@/types/crm'

export default async function AgendaVentasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number((await searchParams).page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const api = await createAuthenticatedServerApiClient()

  // Solo las oportunidades activamente en seguimiento: aceptado/rechazado/en_espera
  // ya están cerradas para el día a día (no tiene sentido agendarlas).
  const [oportunidades, catalogs] = await Promise.all([
    api.listCrmOpportunities({ estado: 'en_seguimiento', order: 'agenda', page, pageSize: 50 }),
    api.getCrmCatalogs(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Agenda de ventas</h1>
      <AgendaVentas
        oportunidades={oportunidades.items as unknown as OportunidadVista[]}
        responsables={catalogs.responsables}
      />
      <CrmPagination path="/ventas/agenda" page={oportunidades.page} pageSize={oportunidades.pageSize} total={oportunidades.total} />
    </div>
  )
}
