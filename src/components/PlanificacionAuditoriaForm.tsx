'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import BuscadorCliente from './BuscadorCliente'

type Cliente = { id: string; nombre: string }
type Domicilio = { id: string; cliente_id: string; alias: string; direccion: string | null; activo: boolean }
type Perfil = { id: string; nombre_completo: string }

const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full'

export default function PlanificacionAuditoriaForm({
  clientes,
  domicilios,
  supervisores,
}: {
  clientes: Cliente[]
  domicilios: Domicilio[]
  supervisores: Perfil[]
}) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [aliasId, setAliasId] = useState('')
  const [fechaPropuesta, setFechaPropuesta] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
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
    setLoading(true)
    const { error: errInsert } = await supabase.from('auditoria_planificaciones').insert({
      alias_id: aliasId,
      fecha_propuesta: fechaPropuesta,
      supervisor_id: supervisorId,
    })
    if (errInsert) {
      setLoading(false)
      setError('Error al guardar: ' + errInsert.message)
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
        <input type="date" value={fechaPropuesta} onChange={(e) => setFechaPropuesta(e.target.value)} className={inputStyle} />
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

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={loading}
        className="self-start px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Planificar auditoría'}
      </button>
    </div>
  )
}
