'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
export default function ClienteForm() {
  const [nombre, setNombre] = useState('')
  const [cuit, setCuit] = useState('')
  const [personaContacto, setPersonaContacto] = useState('')
  const [codigoCostos, setCodigoCostos] = useState('')
  const [presupuesto4hs, setPresupuesto4hs] = useState('0')
  const [presupuesto8hs, setPresupuesto8hs] = useState('0')
  const [domicilio, setDomicilio] = useState('')
  const [llevaInsumos, setLlevaInsumos] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre,
        cuit: cuit || null,
        persona_contacto: personaContacto || null,
        codigo_costos: codigoCostos || null,
        presupuesto_4hs: parseInt(presupuesto4hs) || 0,
        presupuesto_8hs: parseInt(presupuesto8hs) || 0,
        domicilio: domicilio || null,
        lleva_insumos: llevaInsumos,
      })
      .select('id')
      .single()
    if (error || !data) {
      setLoading(false)
      setError('Error al guardar: ' + (error?.message ?? 'desconocido'))
      return
    }

    // Si cargó un domicilio en el alta, lo replicamos como su domicilio de
    // entrega "Principal" (no bloqueante: si esto falla, el cliente ya quedó
    // creado igual, solo no se autocompletó el domicilio de entrega).
    if (domicilio) {
      await supabase.from('cliente_domicilios').insert({
        cliente_id: data.id,
        alias: 'Principal',
        direccion: domicilio,
        es_principal: true,
        activo: true,
      })
    }

    setLoading(false)
    // Vamos directo a la ficha del cliente para poder revisar/agregar más
    // domicilios de entrega, en vez de dejarlo en el listado a buscarlo.
    router.push(`/clientes/${data.id}`)
  }
  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      <input type="text" placeholder="Nombre del cliente" value={nombre} onChange={(e) => setNombre(e.target.value)} required className={`flex-1 min-w-[200px] ${inputStyle}`} />
      <input type="text" placeholder="CUIT (opcional)" value={cuit} onChange={(e) => setCuit(e.target.value)} className={`w-40 ${inputStyle}`} />
      <input type="text" placeholder="Persona de contacto (opcional)" value={personaContacto} onChange={(e) => setPersonaContacto(e.target.value)} className={`w-52 ${inputStyle}`} />
      <input type="text" placeholder="Código de costos (ej: DCLI7836)" value={codigoCostos} onChange={(e) => setCodigoCostos(e.target.value)} className={`w-52 ${inputStyle}`} />
      <input type="text" placeholder="Domicilio (opcional)" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className={`flex-1 min-w-[200px] ${inputStyle}`} />
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Presup. 4hs</label>
        <input type="number" min="0" value={presupuesto4hs} onChange={(e) => setPresupuesto4hs(e.target.value)} className={`w-24 ${inputStyle}`} />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Presup. 8hs</label>
        <input type="number" min="0" value={presupuesto8hs} onChange={(e) => setPresupuesto8hs(e.target.value)} className={`w-24 ${inputStyle}`} />
      </div>
      <div className="flex flex-col items-center">
        <label className="text-xs text-slate-500 mb-1">Insumos</label>
        <input type="checkbox" checked={llevaInsumos} onChange={(e) => setLlevaInsumos(e.target.checked)} className="w-5 h-5 mt-2" />
      </div>
      <button type="submit" disabled={loading} className="px-4 py-2 mt-5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
        {loading ? 'Guardando...' : 'Agregar'}
      </button>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </form>
  )
}