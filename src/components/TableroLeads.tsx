'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { createClient } from '@/utils/supabase/client'
import BotonWhatsApp from './BotonWhatsApp'
import { ESTADOS_LEAD, type LeadVista, type EstadoLead, type PerfilResumen } from '@/types/crm'

function formatearFecha(fecha: string | null): string {
  if (!fecha) return 'Sin fecha'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

function Tarjeta({ lead }: { lead: LeadVista }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-slate-200 rounded-lg shadow-sm p-3 mb-2 ${isDragging ? 'opacity-50 relative z-10' : ''}`}
    >
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
        <p className="text-sm font-medium text-slate-800">{lead.crm_prospectos?.nombre ?? '-'}</p>
        <p className="text-xs text-slate-500 mt-0.5">{lead.crm_prospectos?.contacto_nombre ?? 'Sin contacto'}</p>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <span>{formatearFecha(lead.proxima_fecha_contacto)}</span>
          <span>{lead.perfiles?.nombre_completo ?? '-'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
        <Link
          href={`/ventas/leads/${lead.id}`}
          className="flex-1 text-center text-xs text-teal-600 hover:underline"
        >
          Ver detalle →
        </Link>
        <BotonWhatsApp
          telefono={lead.crm_prospectos?.telefono}
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
  leads,
}: {
  estado: EstadoLead
  etiqueta: string
  leads: LeadVista[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] bg-slate-50 rounded-lg p-3 transition-colors ${isOver ? 'ring-2 ring-teal-400 bg-teal-50/40' : ''}`}
    >
      <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
        {etiqueta} ({leads.length})
      </h3>
      {leads.length === 0 ? (
        <p className="text-xs text-slate-400">Sin leads</p>
      ) : (
        leads.map((l) => <Tarjeta key={l.id} lead={l} />)
      )}
    </div>
  )
}

export default function TableroLeads({
  leads: leadsIniciales,
  responsables,
}: {
  leads: LeadVista[]
  responsables: PerfilResumen[]
}) {
  const [leads, setLeads] = useState(leadsIniciales)
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const supabase = createClient()

  const filtrados = useMemo(() => {
    if (!filtroResponsable) return leads
    return leads.filter((l) => l.responsable_id === filtroResponsable)
  }, [leads, filtroResponsable])

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over) return
    const nuevoEstado = over.id as EstadoLead
    const leadId = active.id as string
    const actual = leads.find((l) => l.id === leadId)
    if (!actual || actual.estado === nuevoEstado) return

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, estado: nuevoEstado } : l)))
    const { error } = await supabase.from('crm_leads').update({ estado: nuevoEstado }).eq('id', leadId)
    if (error) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, estado: actual.estado } : l)))
      alert('Error al cambiar el estado: ' + error.message)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const etiquetaAnterior = ESTADOS_LEAD.find((e) => e.valor === actual.estado)?.etiqueta ?? actual.estado
      const etiquetaNueva = ESTADOS_LEAD.find((e) => e.valor === nuevoEstado)?.etiqueta ?? nuevoEstado
      await supabase.from('crm_seguimientos_leads').insert({
        lead_id: leadId,
        nota: `Estado cambiado de "${etiquetaAnterior}" a "${etiquetaNueva}".`,
        usuario_id: user.id,
      })
    }
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className={selectStyle}>
          <option value="">Todos los responsables</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre_completo}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Link
            href="/ventas/leads/listado"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Ver listado
          </Link>
          <Link
            href="/ventas/leads/nuevo"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Nuevo lead
          </Link>
        </div>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {ESTADOS_LEAD.map(({ valor, etiqueta }) => (
            <Columna
              key={valor}
              estado={valor}
              etiqueta={etiqueta}
              leads={filtrados.filter((l) => l.estado === valor)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
