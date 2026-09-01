'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { EstadoPlanAccion, PlanAccionItem } from '@/types/auditoria'

type OpcionNoConforme = { respuestaId: string; texto: string }
type Perfil = { id: string; nombre_completo: string }

function hoyISO() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

function formatearFecha(fecha: string | null) {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

const ETIQUETAS_ESTADO: Record<EstadoPlanAccion, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  resuelto: 'Resuelto',
}

const COLORES_ESTADO: Record<EstadoPlanAccion, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  en_curso: 'bg-blue-100 text-blue-700',
  resuelto: 'bg-emerald-100 text-emerald-700',
}

const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full'

export default function PlanAccionPanel({
  auditoriaId,
  opcionesNoConformes,
  responsables,
  planes,
}: {
  auditoriaId: string
  opcionesNoConformes: OpcionNoConforme[]
  responsables: Perfil[]
  planes: PlanAccionItem[]
}) {
  const [vinculo, setVinculo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  async function agregar() {
    setError('')
    if (!descripcion.trim()) {
      setError('Falta describir el plan de acción.')
      return
    }
    setGuardando(true)
    const { error: errInsert } = await supabase.from('auditoria_plan_accion').insert({
      auditoria_id: auditoriaId,
      respuesta_id: vinculo || null,
      descripcion: descripcion.trim(),
      responsable_id: responsableId || null,
      fecha_limite: fechaLimite || null,
    })
    if (errInsert) {
      setError('Error al guardar: ' + errInsert.message)
      setGuardando(false)
      return
    }
    setVinculo('')
    setDescripcion('')
    setResponsableId('')
    setFechaLimite('')
    setGuardando(false)
    router.refresh()
  }

  async function cambiarEstado(planId: string, nuevoEstado: EstadoPlanAccion) {
    setCambiandoId(planId)
    const { error: errUpdate } = await supabase
      .from('auditoria_plan_accion')
      .update({ estado: nuevoEstado, fecha_resolucion: nuevoEstado === 'resuelto' ? hoyISO() : null })
      .eq('id', planId)
    setCambiandoId(null)
    if (errUpdate) {
      alert('Error al cambiar el estado: ' + errUpdate.message)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Plan de acción ({planes.length})
      </h2>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-4 flex flex-col gap-3">
        <div>
          <p className="text-xs text-slate-500 mb-1">Vinculado a (opcional)</p>
          <select value={vinculo} onChange={(e) => setVinculo(e.target.value)} className={inputStyle}>
            <option value="">General (no vinculado a un ítem puntual)</option>
            {opcionesNoConformes.map((op) => (
              <option key={op.respuestaId} value={op.respuestaId}>{op.texto}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Descripción</p>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={inputStyle} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500 mb-1">Responsable (opcional)</p>
            <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className={inputStyle}>
              <option value="">Sin asignar</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre_completo}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Fecha límite (opcional)</p>
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className={inputStyle} />
          </div>
        </div>
        {error && <p className="text-rose-600 text-sm">{error}</p>}
        <button
          type="button"
          onClick={agregar}
          disabled={guardando}
          className="self-start px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Agregar plan de acción'}
        </button>
      </div>

      {planes.length === 0 ? (
        <p className="text-slate-500 text-sm">Todavía no hay planes de acción cargados para esta auditoría.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {planes.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-sm text-slate-800">{p.descripcion}</p>
                <select
                  value={p.estado}
                  onChange={(e) => cambiarEstado(p.id, e.target.value as EstadoPlanAccion)}
                  disabled={cambiandoId === p.id}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 shrink-0 ${COLORES_ESTADO[p.estado]}`}
                >
                  {(Object.keys(ETIQUETAS_ESTADO) as EstadoPlanAccion[]).map((e) => (
                    <option key={e} value={e}>{ETIQUETAS_ESTADO[e]}</option>
                  ))}
                </select>
              </div>
              {p.auditoria_respuestas?.auditoria_checklist_items?.texto && (
                <p className="text-xs text-teal-700 mb-1">
                  Vinculado a: {p.auditoria_respuestas.auditoria_checklist_items.texto}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 text-xs text-slate-500">
                <span>Responsable: {p.perfiles?.nombre_completo ?? '-'}</span>
                <span>Fecha límite: {formatearFecha(p.fecha_limite)}</span>
                {p.estado === 'resuelto' && <span>Resuelto el: {formatearFecha(p.fecha_resolucion)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
