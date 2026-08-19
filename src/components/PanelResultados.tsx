'use client'
import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { RUBROS, formatearMesAnio, clavePeriodo, type ResultadoMensual } from '@/types/resultados'

function formatearMonto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '-'
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor)
}

function formatearMontoCompacto(valor: number): string {
  return new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(valor)
}

const SERIES_GRAFICO: { campo: 'total_ventas' | 'total_costos_directos' | 'resultado_bruto' | 'resultado_periodo'; nombre: string; color: string }[] = [
  { campo: 'total_ventas', nombre: 'Total Ventas', color: '#0d9488' },
  { campo: 'total_costos_directos', nombre: 'Total Costos Directos', color: '#f59e0b' },
  { campo: 'resultado_bruto', nombre: 'Resultado Bruto', color: '#0ea5e9' },
  { campo: 'resultado_periodo', nombre: 'Resultado del Período', color: '#16a34a' },
]

export default function PanelResultados({ resultados }: { resultados: ResultadoMensual[] }) {
  const [desdeClave, setDesdeClave] = useState<number>(() => {
    if (resultados.length === 0) return 0
    const idx = Math.max(0, resultados.length - 12)
    return clavePeriodo(resultados[idx].anio, resultados[idx].mes)
  })
  const [hastaClave, setHastaClave] = useState<number>(() => {
    if (resultados.length === 0) return 0
    const ultimo = resultados[resultados.length - 1]
    return clavePeriodo(ultimo.anio, ultimo.mes)
  })

  const rango = useMemo(
    () => resultados.filter((r) => {
      const c = clavePeriodo(r.anio, r.mes)
      return c >= desdeClave && c <= hastaClave
    }),
    [resultados, desdeClave, hastaClave]
  )

  // Variación del último mes del rango contra el mes cronológicamente
  // anterior en TODO el historial (no solo dentro del rango elegido), para
  // que el indicador tenga sentido aunque el rango arranque justo ahí.
  const ultimoDelRango = rango[rango.length - 1]
  const indiceUltimoEnTodos = ultimoDelRango ? resultados.findIndex((r) => r.id === ultimoDelRango.id) : -1
  const anterior = indiceUltimoEnTodos > 0 ? resultados[indiceUltimoEnTodos - 1] : null
  let variacion: number | null = null
  if (
    ultimoDelRango?.resultado_periodo != null &&
    anterior?.resultado_periodo != null &&
    anterior.resultado_periodo !== 0
  ) {
    variacion = ((ultimoDelRango.resultado_periodo - anterior.resultado_periodo) / Math.abs(anterior.resultado_periodo)) * 100
  }

  const datosGrafico = rango.map((r) => ({
    label: formatearMesAnio(r.anio, r.mes),
    total_ventas: r.total_ventas,
    total_costos_directos: r.total_costos_directos,
    resultado_bruto: r.resultado_bruto,
    resultado_periodo: r.resultado_periodo,
  }))

  if (resultados.length === 0) {
    return <p className="text-slate-500 text-sm">No hay resultados importados todavía.</p>
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Desde{' '}
          <select value={desdeClave} onChange={(e) => setDesdeClave(Number(e.target.value))} className={selectStyle}>
            {resultados.map((r) => (
              <option key={r.id} value={clavePeriodo(r.anio, r.mes)}>{formatearMesAnio(r.anio, r.mes)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Hasta{' '}
          <select value={hastaClave} onChange={(e) => setHastaClave(Number(e.target.value))} className={selectStyle}>
            {resultados.map((r) => (
              <option key={r.id} value={clavePeriodo(r.anio, r.mes)}>{formatearMesAnio(r.anio, r.mes)}</option>
            ))}
          </select>
        </label>

        {ultimoDelRango && (
          <div className="flex items-center gap-2 text-sm ml-auto">
            <span className="text-slate-500">
              Resultado del Período ({formatearMesAnio(ultimoDelRango.anio, ultimoDelRango.mes)}):
            </span>
            <span className="font-bold text-slate-800">{formatearMonto(ultimoDelRango.resultado_periodo)}</span>
            {variacion !== null && (
              <span className={`inline-flex items-center gap-1 font-medium ${variacion >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(1)}% vs mes anterior
              </span>
            )}
          </div>
        )}
      </div>

      {rango.length === 0 ? (
        <p className="text-slate-500 text-sm">No hay meses en el rango elegido.</p>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Comparativo mensual
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={datosGrafico}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatearMontoCompacto} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(valor: unknown) => formatearMonto(typeof valor === 'number' ? valor : Number(valor))} />
                <Legend />
                {SERIES_GRAFICO.map((s) => (
                  <Bar key={s.campo} dataKey={s.campo} name={s.nombre} fill={s.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide p-4 pb-0">
              Tabla comparativa
            </h2>
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Rubro</th>
                  {rango.map((r) => (
                    <th key={r.id} className="px-4 py-3 font-medium text-right">
                      {formatearMesAnio(r.anio, r.mes)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RUBROS.map((rubro) => (
                  <tr
                    key={rubro.campo}
                    className={`border-b border-slate-100 last:border-0 ${rubro.campo === 'resultado_periodo' ? 'bg-slate-50 font-semibold' : ''}`}
                  >
                    <td className="px-4 py-2 text-slate-700 whitespace-nowrap">{rubro.etiqueta}</td>
                    {rango.map((r) => {
                      const valor = r[rubro.campo]
                      const incidencia =
                        rubro.esIncidenciaSobreVentas && r.total_ventas ? ((valor ?? 0) / r.total_ventas) * 100 : null
                      return (
                        <td key={r.id} className="px-4 py-2 text-right text-slate-700">
                          <div>{formatearMonto(valor)}</div>
                          {incidencia !== null && (
                            <div className="text-xs text-slate-400 font-normal">{incidencia.toFixed(1)}% s/ventas</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
