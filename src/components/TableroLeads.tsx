'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import BotonWhatsApp from './BotonWhatsApp'
import type { CrmLead, CrmLeadState } from '@/lib/api/generated'

export const ESTADOS_LEAD: { valor: Exclude<CrmLeadState, 'convertido'> | CrmLeadState; etiqueta: string }[] = [
  { valor: 'por_contactar', etiqueta: 'Por contactar' },
  { valor: 'en_conversacion', etiqueta: 'En conversación' },
  { valor: 'convertido', etiqueta: 'Convertido' },
  { valor: 'sin_interes', etiqueta: 'Sin interés' },
]

function formatearFecha(fecha: string | null): string {
  if (!fecha) return 'Sin fecha'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

function Tarjeta({ lead }: { lead: CrmLead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id, disabled: lead.estado === 'convertido' })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <div ref={setNodeRef} style={style} className={`bg-white border border-slate-200 rounded-lg shadow-sm p-3 mb-2 ${isDragging ? 'opacity-50' : ''}`}>
      <div {...listeners} {...attributes} className="cursor-grab">
        <p className="text-sm font-medium text-slate-800">{lead.crm_prospectos?.nombre ?? '-'}</p>
        <p className="text-xs text-slate-500 mt-0.5">{lead.crm_prospectos?.contacto_nombre ?? 'Sin contacto'}</p>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <span>{formatearFecha(lead.proxima_fecha_contacto)}</span>
          <span>{lead.perfiles?.nombre_completo ?? '-'}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
        <Link href={`/ventas/leads/${lead.id}`} className="flex-1 text-center text-xs text-teal-600 hover:underline">Ver detalle →</Link>
        <BotonWhatsApp telefono={lead.crm_prospectos?.telefono} className="text-xs text-emerald-600 hover:underline" classNameDeshabilitado="text-xs text-slate-300" />
      </div>
    </div>
  )
}

function Columna({ estado, etiqueta, leads }: { estado: CrmLeadState; etiqueta: string; leads: CrmLead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: estado, disabled: estado === 'convertido' })
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-[240px] bg-slate-50 rounded-lg p-3 ${isOver ? 'ring-2 ring-teal-400' : ''}`}>
      <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">{etiqueta} ({leads.length})</h3>
      {leads.length === 0 ? <p className="text-xs text-slate-400">Sin leads</p> : leads.map((lead) => <Tarjeta key={lead.id} lead={lead} />)}
    </div>
  )
}

export default function TableroLeads({ leads: iniciales }: { leads: CrmLead[] }) {
  const [leads, setLeads] = useState(iniciales)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleDragEnd(event: DragEndEvent) {
    const nuevoEstado = event.over?.id
    const leadId = String(event.active.id)
    if (nuevoEstado !== 'por_contactar' && nuevoEstado !== 'en_conversacion' && nuevoEstado !== 'sin_interes') return
    const actual = leads.find((lead) => lead.id === leadId)
    if (!actual || actual.estado === nuevoEstado) return
    setError('')
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, estado: nuevoEstado } : lead)))
    try {
      const api = await createAuthenticatedBrowserApiClient()
      const updated = await api.transitionCrmLead(leadId, { estado: nuevoEstado })
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? updated : lead)))
      router.refresh()
    } catch (cause) {
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? actual : lead)))
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado')
    }
  }

  return (
    <div>
      {error && <p className="text-rose-600 text-sm mb-3">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-5">
        <div className="flex gap-2">
          <Link href="/ventas/leads/listado" className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg">Ver listado</Link>
          <Link href="/ventas/leads/nuevo" className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg">+ Nuevo lead</Link>
        </div>
      </div>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {ESTADOS_LEAD.map(({ valor, etiqueta }) => (
            <Columna key={valor} estado={valor} etiqueta={etiqueta} leads={leads.filter((lead) => lead.estado === valor)} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
