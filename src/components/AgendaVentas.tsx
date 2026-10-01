'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { ItemAgenda, PerfilResumen, TipoItemAgenda } from '@/types/crm'

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

type Grupo = 'vencidos' | 'hoy' | 'semana' | 'sin_fecha'

const ETIQUETA_TIPO: Record<TipoItemAgenda, string> = {
  oportunidad: 'Oportunidad',
  lead: 'Lead',
}

const ESTILO_TIPO: Record<TipoItemAgenda, string> = {
  oportunidad: 'bg-teal-100 text-teal-700',
  lead: 'bg-indigo-100 text-indigo-700',
}

function Tarjeta({ item, hoy }: { item: ItemAgenda; hoy: string }) {
  const diff = item.fecha ? diasEntre(hoy, item.fecha) : null

  return (
    <Link
      href={item.href}
      className="block bg-white border border-slate-200 rounded-lg shadow-sm p-3 hover:border-teal-300 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${ESTILO_TIPO[item.tipo]}`}>
          {ETIQUETA_TIPO[item.tipo]}
        </span>
        {item.fecha && (
          <span className={`text-xs font-medium ${diff! < 0 ? 'text-rose-600' : diff === 0 ? 'text-amber-600' : 'text-slate-500'}`}>
            {formatearFecha(item.fecha)}
            {diff! < 0 ? ` (vencido hace ${Math.abs(diff!)}d)` : ''}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-slate-800 mt-1">{item.cliente}</p>
      <p className="text-xs text-slate-500 mt-0.5">{item.subtitulo}</p>
      <div className="flex items-center justify-between mt-1.5 text-xs">
        <span className="text-teal-700 font-semibold">{item.montoTexto ?? ''}</span>
        <span className="text-slate-500">{item.responsableNombre}</span>
      </div>
    </Link>
  )
}

function Seccion({
  titulo,
  descripcion,
  items,
  hoy,
  colorTitulo,
}: {
  titulo: string
  descripcion: string
  items: ItemAgenda[]
  hoy: string
  colorTitulo: string
}) {
  return (
    <div className="mb-6">
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-1 ${colorTitulo}`}>
        {titulo} ({items.length})
      </h2>
      <p className="text-xs text-slate-400 mb-3">{descripcion}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Nada por acá.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {items.map((item) => (
            <Tarjeta key={`${item.tipo}-${item.id}`} item={item} hoy={hoy} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AgendaVentas({
  items,
  responsables,
}: {
  items: ItemAgenda[]
  responsables: PerfilResumen[]
}) {
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoItemAgenda>('')
  const hoy = hoyStr()

  const filtrados = useMemo(() => {
    let base = items
    if (filtroResponsable) base = base.filter((i) => i.responsableId === filtroResponsable)
    if (filtroTipo) base = base.filter((i) => i.tipo === filtroTipo)
    return base
  }, [items, filtroResponsable, filtroTipo])

  const grupos = useMemo(() => {
    const porGrupo: Record<Grupo, ItemAgenda[]> = { vencidos: [], hoy: [], semana: [], sin_fecha: [] }
    for (const i of filtrados) {
      if (!i.fecha) {
        porGrupo.sin_fecha.push(i)
        continue
      }
      const diff = diasEntre(hoy, i.fecha)
      if (diff < 0) porGrupo.vencidos.push(i)
      else if (diff === 0) porGrupo.hoy.push(i)
      else if (diff <= 7) porGrupo.semana.push(i)
      // más allá de 7 días: no es tema de esta pantalla, aparece más adelante
    }
    porGrupo.vencidos.sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))
    porGrupo.semana.sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))
    return porGrupo
  }, [filtrados, hoy])

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as '' | TipoItemAgenda)} className={selectStyle}>
            <option value="">Todo (oportunidades y leads)</option>
            <option value="oportunidad">Solo oportunidades</option>
            <option value="lead">Solo leads</option>
          </select>
          <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className={selectStyle}>
            <option value="">Todos los responsables</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre_completo}</option>
            ))}
          </select>
        </div>
      </div>

      <Seccion
        titulo="Vencidos"
        descripcion="Seguimientos o contactos que ya deberían haberse hecho."
        items={grupos.vencidos}
        hoy={hoy}
        colorTitulo="text-rose-600"
      />
      <Seccion
        titulo="Hoy"
        descripcion="Programados para hoy."
        items={grupos.hoy}
        hoy={hoy}
        colorTitulo="text-amber-600"
      />
      <Seccion
        titulo="Esta semana"
        descripcion="Próximos 7 días."
        items={grupos.semana}
        hoy={hoy}
        colorTitulo="text-slate-600"
      />
      <Seccion
        titulo="Sin fecha programada"
        descripcion="En curso pero sin una próxima fecha — fácil perderles el rastro."
        items={grupos.sin_fecha}
        hoy={hoy}
        colorTitulo="text-slate-500"
      />
    </div>
  )
}
