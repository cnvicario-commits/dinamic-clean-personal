'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import BuscadorCliente from './BuscadorCliente'
import type { PlanificacionEdicion } from '@/types/auditoria'

type Cliente = { id: string; nombre: string }
type Domicilio = { id: string; cliente_id: string; alias: string; direccion: string | null; activo: boolean }
type Perfil = { id: string; nombre_completo: string }

const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full'

export default function PlanificacionAuditoriaForm({
  clientes,
  domicilios,
  supervisores,
  planificacion,
}: {
  clientes: Cliente[]
  domicilios: Domicilio[]
  supervisores: Perfil[]
  // Si viene cargada, el formulario edita esa planificación en vez de crear
  // una nueva (mismo componente para las dos pantallas, como ProveedorForm).
  planificacion?: PlanificacionEdicion
}) {
  const clienteInicial = planificacion?.cliente_domicilios?.clientes ?? null
  const [cliente, setCliente] = useState<Cliente | null>(clienteInicial)
  const [aliasId, setAliasId] = useState(planificacion?.alias_id ?? '')
  const [fechaPropuesta, setFechaPropuesta] = useState(planificacion?.fecha_propuesta ?? '')
  const [horarioDesde, setHorarioDesde] = useState(planificacion?.horario_desde ?? '')
  const [horarioHasta, setHorarioHasta] = useState(planificacion?.horario_hasta ?? '')
  const [supervisorId, setSupervisorId] = useState(planificacion?.supervisor_id ?? '')
  const [observaciones, setObservaciones] = useState(planificacion?.observaciones ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const sitiosDelCliente = cliente ? domicilios.filter((d) => d.cliente_id === cliente.id && d.activo) : []

  async function guardar() {
    setError('')
    if (!aliasId) {
      setError('Elegí el sitio del cliente que se va a auditar.')
      return
    }
    if (!fechaPropuesta) {
      setError('Falta la fecha propuesta.')
      return
    }
    if (!supervisorId) {
      setError('Falta el supervisor responsable.')
      return
    }
    if (horarioDesde && horarioHasta && horarioHasta <= horarioDesde) {
      setError('El horario "hasta" tiene que ser posterior al horario "desde".')
      return
    }
    setLoading(true)
    const datos = {
      alias_id: aliasId,
      fecha_propuesta: fechaPropuesta,
      horario_desde: horarioDesde || null,
      horario_hasta: horarioHasta || null,
      supervisor_id: supervisorId,
      observaciones: observaciones.trim() || null,
    }
    const { error: errGuardar } = planificacion
      ? await supabase.from('auditoria_planificaciones').update(datos).eq('id', planificacion.id)
      : await supabase.from('auditoria_planificaciones').insert(datos)
    if (errGuardar) {
      setLoading(false)
      setError('Error al guardar: ' + errGuardar.message)
      return
    }
    router.push('/auditorias/planificacion')
    router.refresh()
  }

  return (
    <div className="max-w-lg flex flex-col gap-4">
      <div>
        <p className="text-xs text-slate-500 mb-1">Cliente</p>
        <BuscadorCliente
          clientes={clientes}
          clienteInicial={clienteInicial ?? undefined}
          onSeleccionar={(c) => {
            setCliente(c.id ? c : null)
            setAliasId('')
          }}
        />
      </div>

      {cliente && (
        <div>
          <p className="text-xs text-slate-500 mb-1">Sitio a auditar</p>
          {sitiosDelCliente.length === 0 ? (
            <p className="text-sm text-slate-500">Este cliente no tiene sitios activos cargados.</p>
          ) : (
            <select value={aliasId} onChange={(e) => setAliasId(e.target.value)} className={inputStyle}>
              <option value="">Elegir sitio...</option>
              {sitiosDelCliente.map((d) => (
                <option key={d.id} value={d.id}>{d.direccion ? `${d.alias} — ${d.direccion}` : d.alias}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div>
        <p className="text-xs text-slate-500 mb-1">Fecha propuesta</p>
        <input type="date" value={fechaPropuesta} onChange={(e) => setFechaPropuesta(e.target.value)} className={`sm:w-56 ${inputStyle}`} />
      </div>

      <div className="flex gap-4">
        <div className="w-36">
          <p className="text-xs text-slate-500 mb-1">Horario desde (opcional)</p>
          <input type="time" value={horarioDesde} onChange={(e) => setHorarioDesde(e.target.value)} className={inputStyle} />
        </div>
        <div className="w-36">
          <p className="text-xs text-slate-500 mb-1">Horario hasta (opcional)</p>
          <input type="time" value={horarioHasta} onChange={(e) => setHorarioHasta(e.target.value)} className={inputStyle} />
        </div>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1">Supervisor responsable</p>
        <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={inputStyle}>
          <option value="">Elegir supervisor...</option>
          {supervisores.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre_completo}</option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1">Observaciones (opcional)</p>
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} className={inputStyle} />
      </div>

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={loading}
        className="self-start px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Guardando...' : planificacion ? 'Guardar cambios' : 'Planificar auditoría'}
      </button>
    </div>
  )
}
