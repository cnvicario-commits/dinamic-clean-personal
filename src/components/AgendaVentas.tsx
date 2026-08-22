'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { OportunidadVista, PerfilResumen } from '@/types/crm'

function hoyStr(): string {
  const hoy = new Date()
  const offset = hoy.getTimezoneOffset()
  return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00`).getTime()
  const b = new Date(`${hasta}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

function formatearFecha(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function formatearMonto(valor: number | null): string {
  if (valor === null) return '-'
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

type Grupo = 'vencidos' | 'hoy' | 'semana' | 'sin_fecha'

function Tarjeta({ oportunidad, hoy }: { oportunidad: OportunidadVista; hoy: string }) {
  const fecha = oportunidad.proxima_fecha_seguimiento
  const diff = fecha ? diasEntre(hoy, fecha) : null

  return (
    <Link
      href={`/ventas/${oportunidad.id}`}
      className="block bg-white border border-slate-200 rounded-lg shadow-sm p-3 hover:border-teal-300 transition-colors"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-800">{oportunidad.crm_prospectos?.nombre ?? '-'}</p>
        {fecha && (
          <span className={`text-xs font-medium ${diff! < 0 ? 'text-rose-600' : diff === 0 ? 'text-amber-600' : 'text-slate-500'}`}>
            {formatearFecha(fecha)}
            {diff! < 0 ? ` (vencido hace ${Math.abs(diff!)}d)` : ''}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-0.5">{oportunidad.crm_tipos_servicio?.nombre ?? 'Sin tipo de servicio'}</p>
      <div className="flex items-center justify-between mt-1.5 text-xs">
        <span className="text-teal-700 font-semibold">$ {formatearMonto(oportunidad.monto_estimado)}</span>
        <span className="text-slate-500">{oportunidad.perfiles?.nombre_completo ?? '-'}</span>
      </div>
    </Link>
  )
}

function Seccion({
  titulo,
  descripcion,
  oportunidades,
  hoy,
  colorTitulo,
}: {
  titulo: string
  descripcion: string
  oportunidades: OportunidadVista[]
  hoy: string
  colorTitulo: string
}) {
  return (
    <div className="mb-6">
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-1 ${colorTitulo}`}>
        {titulo} ({oportunidades.length})
      </h2>
      <p className="text-xs text-slate-400 mb-3">{descripcion}</p>
      {oportunidades.length === 0 ? (
        <p className="text-sm text-slate-400">Nada por acá.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {oportunidades.map((o) => (
            <Tarjeta key={o.id} oportunidad={o} hoy={hoy} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AgendaVentas({
  oportunidades,
  responsables,
}: {
  oportunidades: OportunidadVista[]
  responsables: PerfilResumen[]
}) {
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const hoy = hoyStr()

  const filtradas = useMemo(() => {
    if (!filtroResponsable) return oportunidades
    return oportunidades.filter((o) => o.responsable_id === filtroResponsable)
  }, [oportunidades, filtroResponsable])

  const grupos = useMemo(() => {
    const porGrupo: Record<Grupo, OportunidadVista[]> = { vencidos: [], hoy: [], semana: [], sin_fecha: [] }
    for (const o of filtradas) {
      const fecha = o.proxima_fecha_seguimiento
      if (!fecha) {
        porGrupo.sin_fecha.push(o)
        continue
      }
      const diff = diasEntre(hoy, fecha)
      if (diff < 0) porGrupo.vencidos.push(o)
      else if (diff === 0) porGrupo.hoy.push(o)
      else if (diff <= 7) porGrupo.semana.push(o)
      // más allá de 7 días: no es tema de esta pantalla, aparece más adelante
    }
    porGrupo.vencidos.sort((a, b) => (a.proxima_fecha_seguimiento! < b.proxima_fecha_seguimiento! ? -1 : 1))
    porGrupo.semana.sort((a, b) => (a.proxima_fecha_seguimiento! < b.proxima_fecha_seguimiento! ? -1 : 1))
    return porGrupo
  }, [filtradas, hoy])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <select
          value={filtroResponsable}
          onChange={(e) => setFiltroResponsable(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos los responsables</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre_completo}</option>
          ))}
        </select>
      </div>

      <Seccion
        titulo="Vencidos"
        descripcion="Seguimientos que ya deberían haberse hecho."
        oportunidades={grupos.vencidos}
        hoy={hoy}
        colorTitulo="text-rose-600"
      />
      <Seccion
        titulo="Hoy"
        descripcion="Seguimientos programados para hoy."
        oportunidades={grupos.hoy}
        hoy={hoy}
        colorTitulo="text-amber-600"
      />
      <Seccion
        titulo="Esta semana"
        descripcion="Próximos 7 días."
        oportunidades={grupos.semana}
        hoy={hoy}
        colorTitulo="text-slate-600"
      />
      <Seccion
        titulo="Sin fecha de seguimiento"
        descripcion="En seguimiento pero sin una próxima fecha programada — fácil perderles el rastro."
        oportunidades={grupos.sin_fecha}
        hoy={hoy}
        colorTitulo="text-slate-500"
      />
    </div>
  )
}
