import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import ResumenEjecutivoVentas from '@/components/ResumenEjecutivoVentas'

export default async function ResumenVentasPage({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string; responsableId?: string }> }) {
  const query = await searchParams
  const api = await createAuthenticatedServerApiClient()
  const [resumen, catalogs] = await Promise.all([
    api.getCrmSummary({ desde: query.desde, hasta: query.hasta, responsableId: query.responsableId }),
    api.getCrmCatalogs(),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6 print:mb-4">Resumen ejecutivo de ventas</h1>
      <ResumenEjecutivoVentas
        resumen={resumen}
        responsables={catalogs.responsables}
        query={query}
      />
    </div>
  )
}
