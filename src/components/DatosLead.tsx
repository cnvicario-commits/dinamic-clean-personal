'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import SelectConCrear from './SelectConCrear'
import BotonWhatsApp from './BotonWhatsApp'
import { ESTADOS_LEAD, type CatalogoItem, type EstadoLead } from '@/types/crm'

function formatearFecha(fecha: string | null) {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{etiqueta}</p>
      <p className="text-sm text-slate-800">{valor}</p>
    </div>
  )
}

const inputStyle = 'w-full px-2 py-1 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

export default function DatosLead({
  lead,
  tiposCliente,
  referidores,
}: {
  lead: {
    id: string
    estado: EstadoLead
    proxima_fecha_contacto: string | null
    notas: string | null
    created_at: string
    oportunidad_id: string | null
    crm_prospectos: {
      id: string
      nombre: string
      tipo_cliente_id: string | null
      contacto_nombre: string | null
      telefono: string | null
      email: string | null
      referido_por_id: string | null
      crm_tipos_cliente: { nombre: string } | null
      crm_referidores: { nombre: string } | null
    } | null
    perfiles: { nombre_completo: string } | null
  }
  tiposCliente: CatalogoItem[]
  referidores: CatalogoItem[]
}) {
  const prospecto = lead.crm_prospectos

  const [estado, setEstado] = useState(lead.estado)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  const [editando, setEditando] = useState(false)
  const [proximaFechaContacto, setProximaFechaContacto] = useState(lead.proxima_fecha_contacto ?? '')
  const [notas, setNotas] = useState(lead.notas ?? '')
  const [tipoClienteId, setTipoClienteId] = useState(prospecto?.tipo_cliente_id ?? '')
  const [tiposClienteState, setTiposClienteState] = useState(tiposCliente)
  const [contactoNombre, setContactoNombre] = useState(prospecto?.contacto_nombre ?? '')
  const [telefono, setTelefono] = useState(prospecto?.telefono ?? '')
  const [email, setEmail] = useState(prospecto?.email ?? '')
  const [referidoPorId, setReferidoPorId] = useState(prospecto?.referido_por_id ?? '')
  const [referidoresState, setReferidoresState] = useState(referidores)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  async function cambiarEstado(nuevoEstado: EstadoLead) {
    if (nuevoEstado === estado) return
    setCambiandoEstado(true)
    setError('')
    const anterior = estado
    setEstado(nuevoEstado)
    const { error: errUpdate } = await supabase.from('crm_leads').update({ estado: nuevoEstado }).eq('id', lead.id)
    setCambiandoEstado(false)
    if (errUpdate) {
      setEstado(anterior)
      setError('Error al cambiar el estado: ' + errUpdate.message)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const etiquetaAnterior = ESTADOS_LEAD.find((e) => e.valor === anterior)?.etiqueta ?? anterior
      const etiquetaNueva = ESTADOS_LEAD.find((e) => e.valor === nuevoEstado)?.etiqueta ?? nuevoEstado
      await supabase.from('crm_seguimientos_leads').insert({
        lead_id: lead.id,
        nota: `Estado cambiado de "${etiquetaAnterior}" a "${etiquetaNueva}".`,
        usuario_id: user.id,
      })
    }
    router.refresh()
  }

  function cancelar() {
    setProximaFechaContacto(lead.proxima_fecha_contacto ?? '')
    setNotas(lead.notas ?? '')
    setTipoClienteId(prospecto?.tipo_cliente_id ?? '')
    setContactoNombre(prospecto?.contacto_nombre ?? '')
    setTelefono(prospecto?.telefono ?? '')
    setEmail(prospecto?.email ?? '')
    setReferidoPorId(prospecto?.referido_por_id ?? '')
    setError('')
    setEditando(false)
  }

  async function guardar() {
    setError('')
    setLoading(true)

    const { error: errUpdate } = await supabase
      .from('crm_leads')
      .update({
        proxima_fecha_contacto: proximaFechaContacto || null,
        notas: notas.trim() || null,
      })
      .eq('id', lead.id)
    if (errUpdate) {
      setLoading(false)
      setError('Error al guardar: ' + errUpdate.message)
      return
    }

    if (prospecto) {
      const { error: errProspecto } = await supabase
        .from('crm_prospectos')
        .update({
          tipo_cliente_id: tipoClienteId || null,
          contacto_nombre: contactoNombre.trim() || null,
          telefono: telefono.trim() || null,
          email: email.trim() || null,
          referido_por_id: referidoPorId || null,
        })
        .eq('id', prospecto.id)
      if (errProspecto) {
        setLoading(false)
        setError('Se guardó el lead, pero falló el prospecto: ' + errProspecto.message)
        return
      }
    }

    setLoading(false)
    setEditando(false)
    router.refresh()
  }

  async function eliminar() {
    if (
      !confirm(
        'Se va a eliminar este lead junto con todo su historial de seguimientos. No se puede deshacer. ¿Confirmás?'
      )
    ) {
      return
    }
    setError('')
    setEliminando(true)
    const { error: errDelete } = await supabase.from('crm_leads').delete().eq('id', lead.id)
    if (errDelete) {
      setEliminando(false)
      setError('Error al eliminar: ' + errDelete.message)
      return
    }
    router.push('/ventas/leads')
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <select
          value={estado}
          onChange={(e) => cambiarEstado(e.target.value as EstadoLead)}
          disabled={cambiandoEstado}
          className="px-3 py-1.5 border border-slate-300 rounded-full text-xs font-medium bg-white"
        >
          {ESTADOS_LEAD.map((e) => (
            <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <BotonWhatsApp telefono={prospecto?.telefono} />
          {!editando ? (
            <>
              <button type="button" onClick={() => setEditando(true)} className="text-sm text-teal-600 hover:underline">
                Editar
              </button>
              <button
                type="button"
                onClick={eliminar}
                disabled={eliminando}
                className="text-sm text-rose-600 hover:underline disabled:opacity-50"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar lead'}
              </button>
            </>
          ) : (
            <div className="flex gap-3">
              <button type="button" onClick={cancelar} className="text-sm text-slate-500 hover:underline" disabled={loading}>
                Cancelar
              </button>
              <button type="button" onClick={guardar} className="text-sm text-teal-600 font-medium hover:underline" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}

      {lead.oportunidad_id ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-4 text-sm text-emerald-800">
          Convertido a oportunidad —{' '}
          <Link href={`/ventas/${lead.oportunidad_id}`} className="font-medium hover:underline">
            ver ficha →
          </Link>
        </div>
      ) : (
        <div className="mb-4">
          <Link
            href={`/ventas/nueva?leadId=${lead.id}&prospectoId=${prospecto?.id ?? ''}`}
            className="inline-block px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Convertir a oportunidad
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Tipo de cliente</p>
            <SelectConCrear
              tabla="crm_tipos_cliente"
              items={tiposClienteState}
              value={tipoClienteId}
              onChange={(id, items) => {
                setTipoClienteId(id)
                setTiposClienteState(items)
              }}
              placeholder="Elegir tipo de cliente"
              className={inputStyle}
            />
          </div>
        ) : (
          <Campo etiqueta="Tipo de cliente" valor={prospecto?.crm_tipos_cliente?.nombre ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Contacto</p>
            <input type="text" value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Contacto" valor={prospecto?.contacto_nombre ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Teléfono</p>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Teléfono" valor={prospecto?.telefono ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Email</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Email" valor={prospecto?.email ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Referido por</p>
            <SelectConCrear
              tabla="crm_referidores"
              items={referidoresState}
              value={referidoPorId}
              onChange={(id, items) => {
                setReferidoPorId(id)
                setReferidoresState(items)
              }}
              placeholder="Referido por (opcional)"
              className={inputStyle}
            />
          </div>
        ) : (
          <Campo etiqueta="Referido por" valor={prospecto?.crm_referidores?.nombre ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Próximo contacto</p>
            <input type="date" value={proximaFechaContacto} onChange={(e) => setProximaFechaContacto(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Próximo contacto" valor={formatearFecha(lead.proxima_fecha_contacto)} />
        )}

        <Campo etiqueta="Creado" valor={formatearFecha(lead.created_at.slice(0, 10))} />
        <Campo etiqueta="Responsable" valor={lead.perfiles?.nombre_completo ?? '-'} />
      </div>

      {editando ? (
        <textarea
          placeholder="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          className="w-full mt-4 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      ) : (
        lead.notas && <p className="text-sm text-slate-600 mt-4">Notas: {lead.notas}</p>
      )}
    </div>
  )
}
