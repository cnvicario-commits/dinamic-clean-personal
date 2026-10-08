import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import TableroVentas from '@/components/TableroVentas'
import CrmPagination from '@/components/CrmPagination'
import PanelNovedades, { type ItemNovedad } from '@/components/PanelNovedades'
import { nombreUsuarioSeguimiento, type OportunidadVista } from '@/types/crm'

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const requestedPage = Number((await searchParams).page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const api = await createAuthenticatedServerApiClient()
  const [dashboard, catalogs] = await Promise.all([
    api.getCrmDashboard({ order: 'created', page, pageSize: 50 }),
    api.getCrmCatalogs(),
  ])

  const itemsNovedades: ItemNovedad[] = dashboard.novedades.map((n) => ({
    oportunidadId: n.oportunidadId,
    prospectoNombre: n.prospectoNombre,
    cantidad: n.cantidad,
    usuario: nombreUsuarioSeguimiento({
      perfiles: n.perfiles,
      usuario_nombre_libre: n.usuarioNombreLibre,
    }),
    nota: n.nota,
    creadoEn: n.creadoEn,
  }))

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Ventas</h1>
      <PanelNovedades items={itemsNovedades} />
      <TableroVentas
        oportunidades={dashboard.items as unknown as OportunidadVista[]}
        responsables={catalogs.responsables}
        tiposCliente={catalogs.tiposCliente}
        novedadesIds={dashboard.novedades.map(n => n.oportunidadId)}
      />
      <CrmPagination path="/ventas" page={dashboard.page} pageSize={dashboard.pageSize} total={dashboard.total} />
    </div>
  )
}
