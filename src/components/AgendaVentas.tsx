'use client'
import { useMemo } from 'react'
import Link from 'next/link'
import type { CrmAgendaItem } from '@/lib/api/generated'

function hoyStr(): string {
  const hoy = new Date()
  const offset = hoy.getTimezoneOffset()
  return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(`${hasta}T00:00:00`).getTime() - new Date(`${desde}T00:00:00`).getTime()) / 86400000)
}

function formatearFecha(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

type Grupo = 'vencidos' | 'hoy' | 'semana' | 'despues' | 'sin_fecha'

const ESTILO_TIPO = {
  oportunidad: 'bg-teal-100 text-teal-700',
  lead: 'bg-indigo-100 text-indigo-700',
} as const

function Tarjeta({ item, hoy }: { item: CrmAgendaItem; hoy: string }) {
  const diff = item.fecha ? diasEntre(hoy, item.fecha) : null
  return (
    <Link href={item.href} className="block bg-white border border-slate-200 rounded-lg shadow-sm p-3 hover:border-teal-300 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ESTILO_TIPO[item.tipo]}`}>
          {item.tipo === 'lead' ? 'Lead' : 'Oportunidad'}
        </span>
        {item.fecha && <span className="text-xs text-slate-500">{formatearFecha(item.fecha)}</span>}
      </div>
      <p className="text-sm font-medium text-slate-800 mt-1">{item.cliente}</p>
      <p className="text-xs text-slate-500 mt-0.5">{item.subtitulo}</p>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-teal-700 font-semibold">{item.montoTexto ?? ''}</span>
        <span className="text-slate-500">{item.responsableNombre}</span>
      </div>
      {diff !== null && diff < 0 && <p className="text-[11px] text-rose-600 mt-1">Vencido</p>}
    </Link>
  )
}

function Seccion({ titulo, descripcion, items, hoy, colorTitulo }: { titulo: string; descripcion: string; items: CrmAgendaItem[]; hoy: string; colorTitulo: string }) {
  return (
    <div className="mb-6">
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-1 ${colorTitulo}`}>{titulo} ({items.length})</h2>
      <p className="text-xs text-slate-400 mb-3">{descripcion}</p>
      {items.length === 0 ? <p className="text-sm text-slate-400">Nada por acá.</p> : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {items.map((item) => <Tarjeta key={`${item.tipo}-${item.id}`} item={item} hoy={hoy} />)}
        </div>
      )}
    </div>
  )
}

export default function AgendaVentas({ items }: { items: CrmAgendaItem[] }) {
  const hoy = hoyStr()
  const grupos = useMemo(() => {
    const porGrupo: Record<Grupo, CrmAgendaItem[]> = { vencidos: [], hoy: [], semana: [], despues: [], sin_fecha: [] }
    for (const item of items) {
      if (!item.fecha) {
        porGrupo.sin_fecha.push(item)
        continue
      }
      const diff = diasEntre(hoy, item.fecha)
      if (diff < 0) porGrupo.vencidos.push(item)
      else if (diff === 0) porGrupo.hoy.push(item)
      else if (diff <= 7) porGrupo.semana.push(item)
      else porGrupo.despues.push(item)
    }
    return porGrupo
  }, [items, hoy])

  return (
    <div>
      <Seccion titulo="Vencidos" descripcion="Contactos que ya deberían haberse hecho." items={grupos.vencidos} hoy={hoy} colorTitulo="text-rose-600" />
      <Seccion titulo="Hoy" descripcion="Programados para hoy." items={grupos.hoy} hoy={hoy} colorTitulo="text-amber-600" />
      <Seccion titulo="Esta semana" descripcion="Próximos 7 días." items={grupos.semana} hoy={hoy} colorTitulo="text-slate-600" />
      <Seccion titulo="Más adelante" descripcion="Con fecha posterior a los próximos 7 días." items={grupos.despues} hoy={hoy} colorTitulo="text-slate-600" />
      <Seccion titulo="Sin fecha programada" descripcion="En curso pero sin una próxima fecha." items={grupos.sin_fecha} hoy={hoy} colorTitulo="text-slate-500" />
    </div>
  )
}
