'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { createClient } from '@/utils/supabase/client'
import BotonWhatsApp from './BotonWhatsApp'
import { ESTADOS, nombreResponsable, type OportunidadVista, type EstadoOportunidad, type PerfilResumen, type CatalogoItem } from '@/types/crm'

function formatearMonto(valor: number | null): string {
  if (valor === null) return '-'
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return 'Sin fecha'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

function Tarjeta({ oportunidad, esNovedad }: { oportunidad: OportunidadVista; esNovedad: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: oportunidad.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-slate-200 rounded-lg shadow-sm p-3 mb-2 ${isDragging ? 'opacity-50 relative z-10' : ''}`}
    >
      {/* El área de arrastre es solo esta parte (no toda la tarjeta), para
          que el link "Ver detalle" de abajo se pueda clickear sin que
          dnd-kit lo interprete como el inicio de un drag. */}
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
        <div className="flex items-center gap-1.5">
          {esNovedad && (
            <span
              className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
              title="Tiene un seguimiento nuevo que todavía no viste"
            />
          )}
          <p className="text-sm font-medium text-slate-800">{oportunidad.crm_prospectos?.nombre ?? '-'}</p>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{oportunidad.crm_tipos_servicio?.nombre ?? 'Sin tipo de servicio'}</p>
        <p className="text-sm font-semibold text-teal-700 mt-1.5">$ {formatearMonto(oportunidad.monto_estimado)}</p>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <span>{formatearFecha(oportunidad.proxima_fecha_seguimiento)}</span>
          <span>{nombreResponsable(oportunidad)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
        <Link
          href={`/ventas/${oportunidad.id}`}
          className="flex-1 text-center text-xs text-teal-600 hover:underline"
        >
          Ver detalle →
        </Link>
        <BotonWhatsApp
          telefono={oportunidad.crm_prospectos?.telefono}
          className="text-xs text-emerald-600 hover:underline"
          classNameDeshabilitado="text-xs text-slate-300 cursor-not-allowed"
        />
      </div>
    </div>
  )
}

function Columna({
  estado,
  etiqueta,
  oportunidades,
  novedadesIds,
}: {
  estado: EstadoOportunidad
  etiqueta: string
  oportunidades: OportunidadVista[]
  novedadesIds: Set<string>
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] bg-slate-50 rounded-lg p-3 transition-colors ${isOver ? 'ring-2 ring-teal-400 bg-teal-50/40' : ''}`}
    >
      <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
        {etiqueta} ({oportunidades.length})
      </h3>
      {oportunidades.length === 0 ? (
        <p className="text-xs text-slate-400">Sin oportunidades</p>
      ) : (
        oportunidades.map((o) => <Tarjeta key={o.id} oportunidad={o} esNovedad={novedadesIds.has(o.id)} />)
      )}
    </div>
  )
}

export default function TableroVentas({
  oportunidades: oportunidadesIniciales,
  responsables,
  tiposCliente,
  novedadesIds = [],
}: {
  oportunidades: OportunidadVista[]
  responsables: PerfilResumen[]
  tiposCliente: CatalogoItem[]
  novedadesIds?: string[]
}) {
  const [oportunidades, setOportunidades] = useState(oportunidadesIniciales)
  const novedadesSet = useMemo(() => new Set(novedadesIds), [novedadesIds])
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('')
  const supabase = createClient()

  const filtradas = useMemo(() => {
    let base = oportunidades
    if (filtroResponsable) base = base.filter((o) => o.responsable_id === filtroResponsable)
    if (filtroTipoCliente) base = base.filter((o) => o.crm_prospectos?.tipo_cliente_id === filtroTipoCliente)
    return base
  }, [oportunidades, filtroResponsable, filtroTipoCliente])

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const nuevoEstado = over.id as EstadoOportunidad
    const oportunidadId = active.id as string
    const actual = oportunidades.find((o) => o.id === oportunidadId)
    if (!actual || actual.estado === nuevoEstado) return

    // Update directo al toque (mismo criterio que el resto de la app para
    // cambios de estado), con reversión visual si la base devuelve error.
    setOportunidades((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, estado: nuevoEstado } : o)))
    const { error } = await supabase.from('crm_oportunidades').update({ estado: nuevoEstado }).eq('id', oportunidadId)
    if (error) {
      setOportunidades((prev) => prev.map((o) => (o.id === oportunidadId ? { ...o, estado: actual.estado } : o)))
      alert('Error al cambiar el estado: ' + error.message)
      return
    }

    // Deja registro en el historial de seguimientos sin que haya que
    // cargarlo a mano — así la ficha siempre muestra quién y cuándo movió
    // la oportunidad de columna. Si esto falla no se avisa ni se revierte
    // nada: el cambio de estado ya se guardó bien, que es lo importante.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const etiquetaAnterior = ESTADOS.find((e) => e.valor === actual.estado)?.etiqueta ?? actual.estado
      const etiquetaNueva = ESTADOS.find((e) => e.valor === nuevoEstado)?.etiqueta ?? nuevoEstado
      await supabase.from('crm_seguimientos').insert({
        oportunidad_id: oportunidadId,
        nota: `Estado cambiado de "${etiquetaAnterior}" a "${etiquetaNueva}".`,
        usuario_id: user.id,
      })
    }
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className={selectStyle}>
            <option value="">Todos los responsables</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre_completo}</option>
            ))}
          </select>
          <select value={filtroTipoCliente} onChange={(e) => setFiltroTipoCliente(e.target.value)} className={selectStyle}>
            <option value="">Todos los tipos de cliente</option>
            {tiposCliente.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Link
            href="/ventas/agenda"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Agenda
          </Link>
          <Link
            href="/ventas/listado"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Ver listado
          </Link>
          <Link
            href="/ventas/resumen"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Resumen ejecutivo
          </Link>
          <Link
            href="/ventas/nueva"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Nueva oportunidad
          </Link>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {ESTADOS.map(({ valor, etiqueta }) => (
            <Columna
              key={valor}
              estado={valor}
              etiqueta={etiqueta}
              oportunidades={filtradas.filter((o) => o.estado === valor)}
              novedadesIds={novedadesSet}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
