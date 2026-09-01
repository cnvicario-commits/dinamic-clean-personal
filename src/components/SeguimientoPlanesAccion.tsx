'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { EstadoPlanAccion, PlanAccionSeguimiento } from '@/types/auditoria'

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

export default function SeguimientoPlanesAccion({
  planes,
  responsables,
}: {
  planes: PlanAccionSeguimiento[]
  responsables: Perfil[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'' | EstadoPlanAccion>('')
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const [soloVencidos, setSoloVencidos] = useState(false)
  const [cambiandoId, setCambiandoId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()
  const hoy = hoyISO()

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return planes
      .filter((p) => {
        if (!q) return true
        const cliente = p.auditorias?.cliente_domicilios?.clientes?.nombre ?? ''
        const sitio = p.auditorias?.cliente_domicilios?.alias ?? ''
        return (
          cliente.toLowerCase().includes(q) ||
          sitio.toLowerCase().includes(q) ||
          p.descripcion.toLowerCase().includes(q)
        )
      })
      .filter((p) => !filtroEstado || p.estado === filtroEstado)
      .filter((p) => !filtroResponsable || p.perfiles?.nombre_completo === filtroResponsable)
      .filter((p) => !soloVencidos || (p.estado !== 'resuelto' && p.fecha_limite && p.fecha_limite < hoy))
      .sort((a, b) => (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999'))
  }, [planes, busqueda, filtroEstado, filtroResponsable, soloVencidos, hoy])

  async function cambiarEstado(planId: string, nuevoEstado: EstadoPlanAccion) {
    setCambiandoId(planId)
    const { error } = await supabase
      .from('auditoria_plan_accion')
      .update({ estado: nuevoEstado, fecha_resolucion: nuevoEstado === 'resuelto' ? hoy : null })
      .eq('id', planId)
    setCambiandoId(null)
    if (error) {
      alert('Error al cambiar el estado: ' + error.message)
      return
    }
    router.refresh()
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Buscar por cliente, sitio o descripción..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className={`${selectStyle} w-64`}
        />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as '' | EstadoPlanAccion)} className={selectStyle}>
          <option value="">Todos los estados</option>
          {(Object.keys(ETIQUETAS_ESTADO) as EstadoPlanAccion[]).map((e) => (
            <option key={e} value={e}>{ETIQUETAS_ESTADO[e]}</option>
          ))}
        </select>
        <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className={selectStyle}>
          <option value="">Todos los responsables</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.nombre_completo}>{r.nombre_completo}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={soloVencidos} onChange={(e) => setSoloVencidos(e.target.checked)} />
          Solo vencidos
        </label>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Planes de acción ({filtrados.length})
      </h2>

      <div className="flex flex-col gap-2">
        {filtrados.map((p) => {
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
                  onChange={(e) => cambiarEstado(p.id, e.target.value as EstadoPlanAccion)}
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
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay planes de acción que coincidan.</p>
      )}
    </div>
  )
}
