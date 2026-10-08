import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import NovedadesFacturacionTabla from '@/components/NovedadesFacturacionTabla'
import CrmPagination from '@/components/CrmPagination'
import type { OportunidadListado } from '@/types/crm'

// Puramente informativa: avisa de altas nuevas para pasarle al área de
// facturación ("a este cliente hay que empezarlo a facturar"), no lleva
// control de la facturación recurrente de clientes ya activos.
export default async function FacturacionVentasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number((await searchParams).page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const api = await createAuthenticatedServerApiClient()
  const oportunidades = await api.listCrmOpportunities({ facturacion: true, order: 'facturacion', page, pageSize: 50 })

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Novedades de Facturación</h1>
      <NovedadesFacturacionTabla oportunidades={oportunidades.items as unknown as OportunidadListado[]} />
      <CrmPagination path="/ventas/facturacion" page={oportunidades.page} pageSize={oportunidades.pageSize} total={oportunidades.total} />
    </div>
  )
}
