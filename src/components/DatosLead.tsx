'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import BotonWhatsApp from './BotonWhatsApp'
import { ESTADOS_LEAD } from './TableroLeads'
import type { CatalogoItem } from '@/types/crm'
import type { CrmLead, CrmLeadState } from '@/lib/api/generated'

const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm'

export default function DatosLead({
  lead,
  tiposCliente,
  referidores,
  puedeEliminar,
}: {
  lead: CrmLead
  tiposCliente: CatalogoItem[]
  referidores: CatalogoItem[]
  puedeEliminar: boolean
}) {
  const prospecto = lead.crm_prospectos
  const [estado, setEstado] = useState(lead.estado)
  const [editando, setEditando] = useState(false)
  const [proximaFecha, setProximaFecha] = useState(lead.proxima_fecha_contacto ?? '')
  const [notas, setNotas] = useState(lead.notas ?? '')
  const [tipoClienteId, setTipoClienteId] = useState(prospecto?.tipo_cliente_id ?? '')
  const [contactoNombre, setContactoNombre] = useState(prospecto?.contacto_nombre ?? '')
  const [telefono, setTelefono] = useState(prospecto?.telefono ?? '')
  const [email, setEmail] = useState(prospecto?.email ?? '')
  const [referidoPorId, setReferidoPorId] = useState(prospecto?.referido_por_id ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function cambiarEstado(nuevoEstado: CrmLeadState) {
    if (nuevoEstado === estado || nuevoEstado === 'convertido') return
    setError('')
    const anterior = estado
    setEstado(nuevoEstado)
    try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.transitionCrmLead(lead.id, { estado: nuevoEstado })
      router.refresh()
    } catch (cause) {
      setEstado(anterior)
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado')
    }
  }

  async function guardar() {
    setLoading(true)
    setError('')
    try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.updateCrmLead(lead.id, {
        proximaFechaContacto: proximaFecha || null,
        notas: notas.trim() || null,
        prospecto: prospecto
          ? {
              tipoClienteId: tipoClienteId || null,
              contactoNombre: contactoNombre.trim() || null,
              telefono: telefono.trim() || null,
              email: email.trim() || null,
              referidoPorId: referidoPorId || null,
            }
          : undefined,
      })
      setEditando(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar')
    } finally {
      setLoading(false)
    }
  }

  async function eliminar() {
    if (!confirm('Se va a eliminar este lead y su historial. ¿Confirmás?')) return
    setLoading(true)
    try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.deleteCrmLead(lead.id)
      router.push('/ventas/leads')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{prospecto?.nombre ?? 'Lead'}</h2>
          <p className="text-sm text-slate-500">{lead.perfiles?.nombre_completo ?? '-'}</p>
        </div>
        <select value={estado} onChange={(e) => cambiarEstado(e.target.value as CrmLeadState)} disabled={estado === 'convertido'} className={inputStyle}>
          {ESTADOS_LEAD.map((item) => (
            <option key={item.valor} value={item.valor} disabled={item.valor === 'convertido'}>{item.etiqueta}</option>
          ))}
        </select>
      </div>
      {estado !== 'convertido' && prospecto && (
        <Link href={`/ventas/nueva?leadId=${lead.id}&prospectoId=${prospecto.id}`} className="inline-block mb-4 text-sm text-teal-700 hover:underline">
          Convertir a oportunidad
        </Link>
      )}
      {lead.oportunidad_id && (
        <p className="text-sm mb-4"><Link href={`/ventas/${lead.oportunidad_id}`} className="text-teal-700 hover:underline">Ver oportunidad vinculada</Link></p>
      )}
      <BotonWhatsApp telefono={prospecto?.telefono} />
      {editando ? (
        <div className="grid gap-3 mt-4">
          <input type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} className={inputStyle} />
          <input value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} placeholder="Contacto" className={inputStyle} />
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" className={inputStyle} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={inputStyle} />
          <select value={tipoClienteId} onChange={(e) => setTipoClienteId(e.target.value)} className={inputStyle}>
            <option value="">Sin tipo de cliente</option>
            {tiposCliente.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
          <select value={referidoPorId} onChange={(e) => setReferidoPorId(e.target.value)} className={inputStyle}>
            <option value="">Sin referidor</option>
            {referidores.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={inputStyle} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditando(false)} className="text-sm text-slate-500">Cancelar</button>
            <button type="button" onClick={guardar} disabled={loading} className="px-3 py-2 bg-teal-600 text-white text-sm rounded-lg">Guardar</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-600 space-y-1">
          <p>Próximo contacto: {lead.proxima_fecha_contacto ?? '-'}</p>
          <p>Contacto: {prospecto?.contacto_nombre ?? '-'}</p>
          <p>Teléfono: {prospecto?.telefono ?? '-'}</p>
          <p>Email: {prospecto?.email ?? '-'}</p>
          <p>Notas: {lead.notas ?? '-'}</p>
          <button type="button" onClick={() => setEditando(true)} className="text-teal-700 hover:underline">Editar</button>
        </div>
      )}
      {puedeEliminar && (
        <button type="button" onClick={eliminar} disabled={loading} className="mt-4 text-sm text-rose-600 hover:underline">Eliminar lead</button>
      )}
      {error && <p className="text-rose-600 text-sm mt-3">{error}</p>}
    </div>
  )
}
