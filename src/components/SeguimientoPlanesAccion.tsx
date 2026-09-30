'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import type { AuditAction } from '@/lib/api/generated'

type Perfil = { id: string; nombre_completo: string }
type EstadoPlanAccion = AuditAction['estado']

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

export default function SeguimientoPlanesAccion({
  planes,
  responsables,
  total,
  filters,
}: {
  planes: AuditAction[]
  responsables: Perfil[]
  total: number
  filters: {
    estado: '' | EstadoPlanAccion
    responsableId: string
    vencidos: boolean
    q: string
  }
}) {
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)
  const [busquedaLocal, setBusquedaLocal] = useState(filters.q)

  const router = useRouter()
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())

  function navegarFiltros(next: {
    estado?: string
    responsableId?: string
    vencidos?: boolean
    q?: string
  }) {
    const params = new URLSearchParams()
    const estado = next.estado ?? filters.estado
    const responsableId = next.responsableId ?? filters.responsableId
    const vencidos = next.vencidos ?? filters.vencidos
    const q = next.q ?? filters.q
    if (estado) params.set('estado', estado)
    if (responsableId) params.set('responsableId', responsableId)
    if (vencidos) params.set('vencidos', 'true')
    if (q.trim()) params.set('q', q.trim())
    params.set('page', '1')
    router.push(`/auditorias/seguimiento?${params.toString()}`)
  }

  async function cambiarEstado(plan: AuditAction, nuevoEstado: EstadoPlanAccion) {
    setCambiandoId(plan.id)
    try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.updateAuditAction(plan.id, { estado: nuevoEstado, updatedAt: plan.updated_at })
    } catch (err) {
      setCambiandoId(null)
      alert('Error al cambiar el estado: ' + (err instanceof Error ? err.message : 'No se pudo actualizar el plan'))
      return
    }
    setCambiandoId(null)
    router.refresh()
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por cliente, sitio o descripción..."
          value={busquedaLocal}
          onChange={(e) => setBusquedaLocal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navegarFiltros({ q: busquedaLocal })
          }}
          onBlur={() => {
            if (busquedaLocal.trim() !== filters.q) navegarFiltros({ q: busquedaLocal })
          }}
          className={`${selectStyle} w-64`}
        />
        <select
          value={filters.estado}
          onChange={(e) => navegarFiltros({ estado: e.target.value })}
          className={selectStyle}
        >
          <option value="">Todos los estados</option>
          {(Object.keys(ETIQUETAS_ESTADO) as EstadoPlanAccion[]).map((e) => (
            <option key={e} value={e}>{ETIQUETAS_ESTADO[e]}</option>
          ))}
        </select>
        <select
          value={filters.responsableId}
          onChange={(e) => navegarFiltros({ responsableId: e.target.value })}
          className={selectStyle}
        >
          <option value="">Todos los responsables</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre_completo}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={filters.vencidos}
            onChange={(e) => navegarFiltros({ vencidos: e.target.checked })}
          />
          Solo vencidos
        </label>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Planes de acción ({total})
      </h2>

      <div className="flex flex-col gap-2">
        {planes.map((p) => {
          const vencido = p.estado !== 'resuelto' && p.fecha_limite !== null && p.fecha_limite < hoy
          return (
            <div key={p.id} className={`bg-white border rounded-lg p-3 ${vencido ? 'border-rose-300' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <Link href={`/auditorias/${p.auditoria_id}`} className="text-sm font-medium text-teal-700 hover:underline">
                    {p.auditorias?.cliente_domicilios?.clientes?.nombre ?? '-'} — {p.auditorias?.cliente_domicilios?.alias ?? '-'}
                  </Link>
                  <p className="text-sm text-slate-800 mt-0.5">{p.descripcion}</p>
                  {p.auditoria_respuestas?.auditoria_checklist_items?.texto && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Vinculado a: {p.auditoria_respuestas.auditoria_checklist_items.texto}
                    </p>
                  )}
                </div>
                <select
                  value={p.estado}
                  onChange={(e) => cambiarEstado(p, e.target.value as EstadoPlanAccion)}
                  disabled={cambiandoId === p.id}
                  className={`text-xs font-medium px-2 py-1 rounded-full border-0 shrink-0 ${COLORES_ESTADO[p.estado]}`}
                >
                  {(Object.keys(ETIQUETAS_ESTADO) as EstadoPlanAccion[]).map((e) => (
                    <option key={e} value={e}>{ETIQUETAS_ESTADO[e]}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-x-4 text-xs text-slate-500 mt-1">
                <span>Responsable: {p.perfiles?.nombre_completo ?? '-'}</span>
                <span className={vencido ? 'text-rose-600 font-medium' : ''}>
                  Fecha límite: {formatearFecha(p.fecha_limite)}{vencido ? ' (vencido)' : ''}
                </span>
                {p.estado === 'resuelto' && <span>Resuelto el: {formatearFecha(p.fecha_resolucion)}</span>}
              </div>
            </div>
          )
        })}
      </div>
      {planes.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay planes de acción que coincidan.</p>
      )}
    </div>
  )
}
