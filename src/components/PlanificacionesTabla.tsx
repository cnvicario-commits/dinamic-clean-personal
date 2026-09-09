'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import type { EstadoPlanificacion, PlanificacionListado } from '@/types/auditoria'

type Perfil = { id: string; nombre_completo: string }

// Estado "vencida" no se guarda solo: una planificación sigue en
// 'planificada' en la base hasta que se cancele o se cargue la auditoría
// (eso la pasa a 'realizada', ver pantalla de carga). Acá se calcula nada
// más que para mostrar/filtrar, sin tocar el dato guardado.
function estadoEfectivo(p: PlanificacionListado): EstadoPlanificacion {
  if (p.estado === 'planificada' && p.fecha_propuesta < new Date().toISOString().slice(0, 10)) {
    return 'vencida'
  }
  return p.estado
}

const ETIQUETAS: Record<EstadoPlanificacion, string> = {
  planificada: 'Planificada',
  vencida: 'Vencida',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
}

const COLORES: Record<EstadoPlanificacion, string> = {
  planificada: 'bg-blue-100 text-blue-700',
  vencida: 'bg-amber-100 text-amber-700',
  realizada: 'bg-emerald-100 text-emerald-700',
  cancelada: 'bg-slate-200 text-slate-600',
}

function formatearFecha(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

// horario viene 'HH:MM:SS' desde una columna `time` de Postgres — se recorta
// a 'HH:MM' para mostrar.
function formatearHorario(horario: string | null) {
  return horario ? horario.slice(0, 5) : '-'
}

export default function PlanificacionesTabla({
  planificaciones,
  supervisores,
}: {
  planificaciones: PlanificacionListado[]
  supervisores: Perfil[]
}) {
  const [filtroEstado, setFiltroEstado] = useState<'' | EstadoPlanificacion>('')
  const [filtroSupervisor, setFiltroSupervisor] = useState('')
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const filtradas = useMemo(() => {
    return planificaciones
      .filter((p) => !filtroEstado || estadoEfectivo(p) === filtroEstado)
      .filter((p) => !filtroSupervisor || p.supervisor_id === filtroSupervisor)
      .sort((a, b) => a.fecha_propuesta.localeCompare(b.fecha_propuesta))
  }, [planificaciones, filtroEstado, filtroSupervisor])

  async function cancelar(id: string) {
    if (!confirm('¿Cancelar esta planificación de auditoría?')) return
    setCancelandoId(id)
    const { error } = await supabase.from('auditoria_planificaciones').update({ estado: 'cancelada' }).eq('id', id)
    setCancelandoId(null)
    if (error) {
      alert('Error al cancelar: ' + error.message)
      return
    }
    router.refresh()
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as '' | EstadoPlanificacion)} className={selectStyle}>
          <option value="">Todos los estados</option>
          {(Object.keys(ETIQUETAS) as EstadoPlanificacion[]).map((e) => (
            <option key={e} value={e}>{ETIQUETAS[e]}</option>
          ))}
        </select>
        <select value={filtroSupervisor} onChange={(e) => setFiltroSupervisor(e.target.value)} className={selectStyle}>
          <option value="">Todos los supervisores</option>
          {supervisores.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre_completo}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Sitio</th>
              <th className="px-4 py-3 font-medium">Domicilio</th>
              <th className="px-4 py-3 font-medium">Fecha propuesta</th>
              <th className="px-4 py-3 font-medium">Horario</th>
              <th className="px-4 py-3 font-medium">Supervisor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((p) => {
              const efectivo = estadoEfectivo(p)
              return (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{p.cliente_domicilios?.clientes?.nombre ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.cliente_domicilios?.alias ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.cliente_domicilios?.direccion ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearFecha(p.fecha_propuesta)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearHorario(p.horario)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.perfiles?.nombre_completo ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${COLORES[efectivo]}`}>
                      {ETIQUETAS[efectivo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.estado === 'planificada' && (
                      <div className="flex items-center justify-end gap-3">
                        <Link href={`/auditorias/nueva?planificacion=${p.id}`} className="text-teal-600 hover:underline">
                          Cargar auditoría
                        </Link>
                        <Link href={`/auditorias/planificacion/${p.id}/editar`} className="text-slate-600 hover:underline">
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => cancelar(p.id)}
                          disabled={cancelandoId === p.id}
                          className="text-rose-600 hover:underline disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filtradas.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay planificaciones que coincidan.</p>
      )}
    </div>
  )
}
