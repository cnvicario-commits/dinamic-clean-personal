import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import ImportarResultadosMensuales from '@/components/ImportarResultadosMensuales'
import PanelResultados from '@/components/PanelResultados'
import type { ResultadoMensual, ResultadoMensualDetalle } from '@/types/resultados'

export default async function ResultadosPage() {
  const api = await createAuthenticatedServerApiClient()
  let resultados: ResultadoMensual[] = []
  let detalle: ResultadoMensualDetalle[] = []
  let error = ''
  try {
    resultados = (await api.listResults()) as unknown as ResultadoMensual[]
    const detalles = await Promise.all(resultados.map((r) => api.getResult(r.id)))
    detalle = detalles.flatMap((r) => (r.details ?? []) as ResultadoMensualDetalle[])
  } catch (e) { error = e instanceof Error ? e.message : 'No se pudieron cargar los resultados' }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Resultados económicos</h1>

      <ImportarResultadosMensuales />

      {error && (
        <p className="text-rose-600 text-sm mb-4">Error al cargar los resultados: {error}</p>
      )}

      <PanelResultados
        resultados={resultados}
        detalle={detalle}
      />
    </div>
  )
}
