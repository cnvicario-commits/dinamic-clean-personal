'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { AuditoriaListado, RespuestaConteo } from '@/types/auditoria'

type Perfil = { id: string; nombre_completo: string }

function formatearFecha(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

export default function ListadoAuditoriasTabla({
  auditorias,
  respuestas,
  supervisores,
}: {
  auditorias: AuditoriaListado[]
  respuestas: RespuestaConteo[]
  supervisores: Perfil[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroSupervisor, setFiltroSupervisor] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const noConformesPorAuditoria = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const r of respuestas) {
      if (r.resultado !== 'no_conforme') continue
      mapa.set(r.auditoria_id, (mapa.get(r.auditoria_id) ?? 0) + 1)
    }
    return mapa
  }, [respuestas])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return auditorias
      .filter((a) => {
        if (!q) return true
        const cliente = a.cliente_domicilios?.clientes?.nombre ?? ''
        const sitio = a.cliente_domicilios?.alias ?? ''
        return cliente.toLowerCase().includes(q) || sitio.toLowerCase().includes(q)
      })
      .filter((a) => !filtroSupervisor || a.perfiles?.nombre_completo === filtroSupervisor)
      .filter((a) => !fechaDesde || a.fecha_realizada >= fechaDesde)
      .filter((a) => !fechaHasta || a.fecha_realizada <= fechaHasta)
      .sort((a, b) => b.fecha_realizada.localeCompare(a.fecha_realizada))
  }, [auditorias, busqueda, filtroSupervisor, fechaDesde, fechaHasta])

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por cliente o sitio..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className={`${selectStyle} w-64`}
        />
        <select value={filtroSupervisor} onChange={(e) => setFiltroSupervisor(e.target.value)} className={selectStyle}>
          <option value="">Todos los supervisores</option>
          {supervisores.map((s) => (
            <option key={s.id} value={s.nombre_completo}>{s.nombre_completo}</option>
          ))}
        </select>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className={selectStyle} />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className={selectStyle} />
        </div>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Auditorías realizadas ({filtradas.length})
      </h2>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Sitio</th>
              <th className="px-4 py-3 font-medium">Supervisor</th>
              <th className="px-4 py-3 font-medium">Evaluación general</th>
              <th className="px-4 py-3 font-medium">No conformidades</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((a) => {
              const noConformes = noConformesPorAuditoria.get(a.id) ?? 0
              return (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-600">{formatearFecha(a.fecha_realizada)}</td>
                  <td className="px-4 py-3 text-slate-800">{a.cliente_domicilios?.clientes?.nombre ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{a.cliente_domicilios?.alias ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{a.perfiles?.nombre_completo ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{a.evaluacion_general ?? '-'}</td>
                  <td className="px-4 py-3">
                    {noConformes > 0 ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-100 text-rose-700">{noConformes}</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/auditorias/${a.id}`} className="text-teal-600 hover:underline">
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filtradas.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay auditorías que coincidan.</p>
      )}
    </div>
  )
}
