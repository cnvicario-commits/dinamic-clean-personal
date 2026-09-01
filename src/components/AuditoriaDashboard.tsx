'use client'
import { useState, useMemo } from 'react'
import type { RespuestaDashboard, AuditoriaResumen, PlanificacionResumen, PlanAccionResumen, EstadoPlanificacion, EstadoPlanAccion } from '@/types/auditoria'

function formatearPorcentaje(parte: number, total: number): string {
  if (total === 0) return '-'
  return `${((parte / total) * 100).toFixed(0)}%`
}

function hoyISO() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

// Mismo criterio que PlanificacionesTabla.tsx: 'vencida' no se guarda en la
// base, se calcula acá nada más que para mostrar.
function estadoEfectivo(p: PlanificacionResumen): EstadoPlanificacion {
  if (p.estado === 'planificada' && p.fecha_propuesta < hoyISO()) return 'vencida'
  return p.estado
}

const ETIQUETAS_PLANIF: Record<EstadoPlanificacion, string> = {
  planificada: 'Planificadas',
  vencida: 'Vencidas',
  realizada: 'Realizadas',
  cancelada: 'Canceladas',
}

const ETIQUETAS_PLAN_ACCION: Record<EstadoPlanAccion, string> = {
  pendiente: 'Pendientes',
  en_curso: 'En curso',
  resuelto: 'Resueltos',
}

export default function AuditoriaDashboard({
  respuestas,
  auditorias,
  planificaciones,
  planesAccion,
}: {
  respuestas: RespuestaDashboard[]
  auditorias: AuditoriaResumen[]
  planificaciones: PlanificacionResumen[]
  planesAccion: PlanAccionResumen[]
}) {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const respuestasFiltradas = useMemo(() => {
    return respuestas.filter((r) => {
      const fecha = r.auditorias?.fecha_realizada ?? ''
      if (fechaDesde && fecha < fechaDesde) return false
      if (fechaHasta && fecha > fechaHasta) return false
      return true
    })
  }, [respuestas, fechaDesde, fechaHasta])

  const auditoriasFiltradas = useMemo(() => {
    return auditorias.filter((a) => {
      if (fechaDesde && a.fecha_realizada < fechaDesde) return false
      if (fechaHasta && a.fecha_realizada > fechaHasta) return false
      return true
    })
  }, [auditorias, fechaDesde, fechaHasta])

  const resumen = useMemo(() => {
    const conformes = respuestasFiltradas.filter((r) => r.resultado === 'conforme').length
    const noConformes = respuestasFiltradas.filter((r) => r.resultado === 'no_conforme').length
    const noAplica = respuestasFiltradas.filter((r) => r.resultado === 'no_aplica').length
    const evaluables = conformes + noConformes

    // % de conformidad por ítem (excluye "no aplica" del denominador),
    // ordenado del peor al mejor para que salten a la vista los problemas.
    const porItem = new Map<string, { conformes: number; noConformes: number }>()
    for (const r of respuestasFiltradas) {
      if (r.resultado === 'no_aplica') continue
      const texto = r.auditoria_checklist_items?.texto ?? '-'
      const actual = porItem.get(texto) ?? { conformes: 0, noConformes: 0 }
      if (r.resultado === 'conforme') actual.conformes += 1
      else actual.noConformes += 1
      porItem.set(texto, actual)
    }
    const conformidadPorItem = Array.from(porItem.entries())
      .map(([texto, v]) => ({ texto, ...v, total: v.conformes + v.noConformes }))
      .sort((a, b) => a.conformes / a.total - b.conformes / b.total)

    // Evolución mensual: % conformidad y cantidad de auditorías por mes.
    const porMes = new Map<string, { conformes: number; noConformes: number }>()
    for (const r of respuestasFiltradas) {
      if (r.resultado === 'no_aplica') continue
      const mes = (r.auditorias?.fecha_realizada ?? '').slice(0, 7)
      if (!mes) continue
      const actual = porMes.get(mes) ?? { conformes: 0, noConformes: 0 }
      if (r.resultado === 'conforme') actual.conformes += 1
      else actual.noConformes += 1
      porMes.set(mes, actual)
    }
    const cantidadPorMes = new Map<string, number>()
    for (const a of auditoriasFiltradas) {
      const mes = a.fecha_realizada.slice(0, 7)
      cantidadPorMes.set(mes, (cantidadPorMes.get(mes) ?? 0) + 1)
    }
    const evolucion = Array.from(new Set([...porMes.keys(), ...cantidadPorMes.keys()]))
      .sort()
      .map((mes) => {
        const v = porMes.get(mes) ?? { conformes: 0, noConformes: 0 }
        return { mes, cantidadAuditorias: cantidadPorMes.get(mes) ?? 0, ...v, total: v.conformes + v.noConformes }
      })

    // Ranking de sitios con más ítems no conformes.
    const porSitio = new Map<string, number>()
    for (const r of respuestasFiltradas) {
      if (r.resultado !== 'no_conforme') continue
      const nombre = `${r.auditorias?.cliente_domicilios?.clientes?.nombre ?? '-'} — ${r.auditorias?.cliente_domicilios?.alias ?? '-'}`
      porSitio.set(nombre, (porSitio.get(nombre) ?? 0) + 1)
    }
    const rankingSitios = Array.from(porSitio.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

    // Planificaciones (estado actual, no se filtra por fecha del panel de
    // arriba: es una foto del estado de hoy, no un histórico).
    const porEstadoPlanificacion = (Object.keys(ETIQUETAS_PLANIF) as EstadoPlanificacion[]).map((estado) => ({
      estado,
      cantidad: planificaciones.filter((p) => estadoEfectivo(p) === estado).length,
    }))

    // Planes de acción.
    const porEstadoPlanAccion = (Object.keys(ETIQUETAS_PLAN_ACCION) as EstadoPlanAccion[]).map((estado) => ({
      estado,
      cantidad: planesAccion.filter((p) => p.estado === estado).length,
    }))
    const hoy = hoyISO()
    const planesVencidos = planesAccion.filter(
      (p) => p.estado !== 'resuelto' && p.fecha_limite && p.fecha_limite < hoy
    ).length

    return {
      conformes,
      noConformes,
      noAplica,
      evaluables,
      conformidadPorItem,
      evolucion,
      rankingSitios,
      porEstadoPlanificacion,
      porEstadoPlanAccion,
      planesVencidos,
    }
  }, [respuestasFiltradas, auditoriasFiltradas, planificaciones, planesAccion])

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Desde (fecha de auditoría)</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className={selectStyle} />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className={selectStyle} />
        </div>
      </div>

      {/* Totales generales */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Auditorías realizadas</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{auditoriasFiltradas.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Conformidad general</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatearPorcentaje(resumen.conformes, resumen.evaluables)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{resumen.conformes} conformes / {resumen.noConformes} no conformes</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Planes de acción vencidos</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{resumen.planesVencidos}</p>
          <p className="text-xs text-slate-400 mt-0.5">sin resolver, con fecha límite pasada</p>
        </div>
      </div>

      {/* Auditorías planificadas */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Planificaciones (estado actual)</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-8">
        {resumen.porEstadoPlanificacion.map((f) => (
          <div key={f.estado} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{ETIQUETAS_PLANIF[f.estado]}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{f.cantidad}</p>
          </div>
        ))}
      </div>

      {/* Conformidad por ítem */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Conformidad por ítem</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Ítem</th>
              <th className="px-4 py-3 font-medium">Conformidad</th>
              <th className="px-4 py-3 font-medium">Evaluado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.conformidadPorItem.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-slate-400">Sin datos para este período.</td>
              </tr>
            ) : (
              resumen.conformidadPorItem.map((fila) => (
                <tr key={fila.texto} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{fila.texto}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${(fila.conformes / fila.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-slate-600">{formatearPorcentaje(fila.conformes, fila.total)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fila.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Evolución mensual */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Evolución mensual</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Mes</th>
              <th className="px-4 py-3 font-medium">Auditorías</th>
              <th className="px-4 py-3 font-medium">Conformidad</th>
            </tr>
          </thead>
          <tbody>
            {resumen.evolucion.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-slate-400">Sin datos para este período.</td>
              </tr>
            ) : (
              resumen.evolucion.map((fila) => (
                <tr key={fila.mes} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{fila.mes}</td>
                  <td className="px-4 py-3 text-slate-600">{fila.cantidadAuditorias}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.conformes, fila.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Ranking de sitios con más no conformidades */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Sitios con más no conformidades</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Sitio</th>
              <th className="px-4 py-3 font-medium">No conformidades</th>
            </tr>
          </thead>
          <tbody>
            {resumen.rankingSitios.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-slate-400">Sin no conformidades en este período.</td>
              </tr>
            ) : (
              resumen.rankingSitios.map((fila) => (
                <tr key={fila.nombre} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{fila.nombre}</td>
                  <td className="px-4 py-3 text-rose-600 font-medium">{fila.cantidad}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Planes de acción */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Planes de acción</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        {resumen.porEstadoPlanAccion.map((f) => (
          <div key={f.estado} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{ETIQUETAS_PLAN_ACCION[f.estado]}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{f.cantidad}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
