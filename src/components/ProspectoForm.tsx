'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import SelectConCrear from './SelectConCrear'
import type { CatalogoItem } from '@/types/crm'

// Alta rápida de un prospecto, embebida en el alta de oportunidad (mismo
// patrón onCreated que ArticuloForm.tsx: al crearse, devuelve el id/nombre
// al padre para que siga el flujo en vez de quedarse en esta pantalla).
export default function ProspectoForm({
  nombreSugerido,
  tiposCliente,
  referidores,
  onCreated,
}: {
  nombreSugerido?: string
  tiposCliente: CatalogoItem[]
  referidores: CatalogoItem[]
  onCreated: (prospecto: { id: string; nombre: string }) => void
}) {
  const [nombre, setNombre] = useState(nombreSugerido ?? '')
  const [tipoClienteId, setTipoClienteId] = useState('')
  const [tiposClienteState, setTiposClienteState] = useState(tiposCliente)
  const [contactoNombre, setContactoNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [referidoPorId, setReferidoPorId] = useState('')
  const [referidoresState, setReferidoresState] = useState(referidores)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function crear() {
    setError('')
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setLoading(true)
    const { data, error: errInsert } = await supabase
      .from('crm_prospectos')
      .insert({
        nombre: nombre.trim(),
        tipo_cliente_id: tipoClienteId || null,
        contacto_nombre: contactoNombre || null,
        telefono: telefono || null,
        email: email || null,
        referido_por_id: referidoPorId || null,
      })
      .select('id, nombre')
      .single()
    setLoading(false)
    if (errInsert || !data) {
      setError('Error al crear el prospecto: ' + (errInsert?.message ?? 'desconocido'))
      return
    }
    onCreated(data)
  }

  const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  return (
    // No es un <form>: este componente se embebe dentro del <form> del alta
    // de oportunidad (OportunidadForm.tsx), y un <form> anidado en otro no
    // es válido HTML — el navegador termina disparando el submit del de
    // afuera en vez del de acá. Por eso "Crear prospecto" es un botón
    // type="button" con onClick, no un submit.
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap gap-2 items-start">
      <input
        type="text"
        placeholder="Nombre del prospecto"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className={`flex-1 min-w-[200px] ${inputStyle}`}
      />
      <SelectConCrear
        tabla="crm_tipos_cliente"
        items={tiposClienteState}
        value={tipoClienteId}
        onChange={(id, items) => {
          setTipoClienteId(id)
          setTiposClienteState(items)
        }}
        placeholder="Tipo de cliente"
        className={`w-48 ${inputStyle}`}
      />
      <input
        type="text"
        placeholder="Persona de contacto"
        value={contactoNombre}
        onChange={(e) => setContactoNombre(e.target.value)}
        className={`w-48 ${inputStyle}`}
      />
      <input
        type="text"
        placeholder="Teléfono"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        className={`w-40 ${inputStyle}`}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={`w-52 ${inputStyle}`}
      />
      <SelectConCrear
        tabla="crm_referidores"
        items={referidoresState}
        value={referidoPorId}
        onChange={(id, items) => {
          setReferidoPorId(id)
          setReferidoresState(items)
        }}
        placeholder="Referido por (opcional)"
        className={`w-48 ${inputStyle}`}
      />
      <button
        type="button"
        onClick={crear}
        disabled={loading}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear prospecto'}
      </button>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </div>
  )
}
