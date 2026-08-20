import { createClient } from '@/utils/supabase/server'
import ImportarResultadosMensuales from '@/components/ImportarResultadosMensuales'
import PanelResultados from '@/components/PanelResultados'
import type { ResultadoMensual, ResultadoMensualDetalle } from '@/types/resultados'

export default async function ResultadosPage() {
  const supabase = await createClient()
  const [{ data: resultados, error }, { data: detalle }] = await Promise.all([
    supabase
      .from('resultados_mensuales')
      .select('*')
      .order('anio', { ascending: true })
      .order('mes', { ascending: true }),
    supabase.from('resultados_mensuales_detalle').select('*'),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Resultados económicos</h1>

      <ImportarResultadosMensuales />

      {error && (
        <p className="text-rose-600 text-sm mb-4">Error al cargar los resultados: {error.message}</p>
      )}

      <PanelResultados
        resultados={(resultados ?? []) as ResultadoMensual[]}
        detalle={(detalle ?? []) as ResultadoMensualDetalle[]}
      />
    </div>
  )
}
