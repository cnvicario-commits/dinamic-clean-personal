'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AuditDashboard, AuditAction } from '@/lib/api/generated'
import type { EstadoPlanificacion } from '@/types/auditoria'

function formatearPorcentaje(parte: number, total: number): string {
  if (total === 0) return '-'
  return `${((parte / total) * 100).toFixed(0)}%`
}

function formatearFecha(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

const ETIQUETAS_PLANIF: Record<EstadoPlanificacion, string> = {
  planificada: 'Planificadas',
  vencida: 'Vencidas',
  realizada: 'Realizadas',
  cancelada: 'Canceladas',
}

const ETIQUETAS_PLAN_ACCION: Record<AuditAction['estado'], string> = {
  pendiente: 'Pendientes',
  en_curso: 'En curso',
  resuelto: 'Resueltos',
}

const ESTADOS_PLANIF: EstadoPlanificacion[] = ['planificada', 'vencida', 'realizada', 'cancelada']
const ESTADOS_ACCION: AuditAction['estado'][] = ['pendiente', 'en_curso', 'resuelto']

export default function AuditoriaDashboard({
  dashboard,
  desde,
  hasta,
}: {
  dashboard: AuditDashboard
  desde: string
  hasta: string
}) {
  const router = useRouter()

  function navegarFechas(nextDesde: string, nextHasta: string) {
    const params = new URLSearchParams()
    if (nextDesde) params.set('desde', nextDesde)
    if (nextHasta) params.set('hasta', nextHasta)
    const qs = params.toString()
    router.push(qs ? `/auditorias?${qs}` : '/auditorias')
  }

  const porEstadoPlanificacion = ESTADOS_PLANIF.map((estado) => ({
    estado,
    cantidad: dashboard.por_estado_planificacion.find((f) => f.estado === estado)?.cantidad ?? 0,
  }))

  const porEstadoPlanAccion = ESTADOS_ACCION.map((estado) => ({
    estado,
    cantidad: dashboard.por_estado_plan_accion.find((f) => f.estado === estado)?.cantidad ?? 0,
  }))

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Desde (fecha de auditoría)</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => navegarFechas(e.target.value, hasta)}
            className={selectStyle}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => navegarFechas(desde, e.target.value)}
            className={selectStyle}
          />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Sitios auditados</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{dashboard.sitios_auditados}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">% Cumplimiento promedio</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {dashboard.conformidad_general === null
              ? '-'
              : `${(dashboard.conformidad_general * 100).toFixed(0)}%`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {dashboard.conformes} conformes / {dashboard.no_conformes} no conformes
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total no conformidades</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{dashboard.no_conformes}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Quejas/reclamos registrados</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{dashboard.quejas_registradas}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Planes de acción vencidos</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{dashboard.planes_vencidos}</p>
          <p className="text-xs text-slate-400 mt-0.5">sin resolver, con fecha límite pasada</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Planificaciones (estado actual)</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-8">
        {porEstadoPlanificacion.map((f) => (
          <div key={f.estado} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{ETIQUETAS_PLANIF[f.estado]}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{f.cantidad}</p>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Auditorías con menor % de cumplimiento</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Sitio</th>
              <th className="px-4 py-3 font-medium">Supervisor</th>
              <th className="px-4 py-3 font-medium">% Cumplimiento</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {dashboard.auditorias_peor_cumplimiento.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-slate-400">Sin datos para este período.</td>
              </tr>
            ) : (
              dashboard.auditorias_peor_cumplimiento.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-600">{formatearFecha(a.fecha)}</td>
                  <td className="px-4 py-3 text-slate-800">{a.cliente}</td>
                  <td className="px-4 py-3 text-slate-600">{a.sitio}</td>
                  <td className="px-4 py-3 text-slate-600">{a.supervisor}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${a.pct < 0.8 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {(a.pct * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/auditorias/${a.id}`} className="text-teal-600 hover:underline">Ver ficha</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
            {dashboard.conformidad_por_item.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-slate-400">Sin datos para este período.</td>
              </tr>
            ) : (
              dashboard.conformidad_por_item.map((fila) => (
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
            {dashboard.evolucion.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-slate-400">Sin datos para este período.</td>
              </tr>
            ) : (
              dashboard.evolucion.map((fila) => (
                <tr key={fila.mes} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{fila.mes}</td>
                  <td className="px-4 py-3 text-slate-600">{fila.cantidad_auditorias}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.conformes, fila.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Sitios con peor % de cumplimiento</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Sitio</th>
              <th className="px-4 py-3 font-medium">Cumplimiento</th>
              <th className="px-4 py-3 font-medium">Evaluado</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.ranking_sitios_cumplimiento.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-slate-400">Sin datos para este período.</td>
              </tr>
            ) : (
              dashboard.ranking_sitios_cumplimiento.map((fila) => (
                <tr key={fila.nombre} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{fila.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.conformes, fila.total)}</td>
                  <td className="px-4 py-3 text-slate-600">{fila.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
            {dashboard.ranking_sitios_cantidad.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-3 text-slate-400">Sin no conformidades en este período.</td>
              </tr>
            ) : (
              dashboard.ranking_sitios_cantidad.map((fila) => (
                <tr key={fila.nombre} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{fila.nombre}</td>
                  <td className="px-4 py-3 text-rose-600 font-medium">{fila.cantidad}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Planes de acción</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        {porEstadoPlanAccion.map((f) => (
          <div key={f.estado} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{ETIQUETAS_PLAN_ACCION[f.estado]}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{f.cantidad}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
