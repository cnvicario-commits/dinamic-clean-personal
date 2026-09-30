import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import ListadoOportunidadesTabla from '@/components/ListadoOportunidadesTabla'
import CrmPagination from '@/components/CrmPagination'
import type { OportunidadListado } from '@/types/crm'

export default async function ListadoVentasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number((await searchParams).page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const api = await createAuthenticatedServerApiClient()
  const [oportunidades, catalogs] = await Promise.all([
    api.listCrmOpportunities({ order: 'ingreso', page, pageSize: 50 }),
    api.getCrmCatalogs(),
  ])

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Listado de oportunidades</h1>
      <ListadoOportunidadesTabla
        oportunidades={oportunidades.items as unknown as OportunidadListado[]}
        responsables={catalogs.responsables}
        tiposCliente={catalogs.tiposCliente}
      />
      <CrmPagination path="/ventas/listado" page={oportunidades.page} pageSize={oportunidades.pageSize} total={oportunidades.total} />
    </div>
  )
}
