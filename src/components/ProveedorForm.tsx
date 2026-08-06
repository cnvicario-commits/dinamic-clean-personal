'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Proveedor = {
  id: string
  razon_social: string
  cuit: string
  domicilio: string | null
  telefono: string | null
}

export default function ProveedorForm({
  proveedor,
  onGuardado,
}: {
  proveedor?: Proveedor
  onGuardado?: () => void
}) {
  const [razonSocial, setRazonSocial] = useState(proveedor?.razon_social ?? '')
  const [cuit, setCuit] = useState(proveedor?.cuit ?? '')
  const [domicilio, setDomicilio] = useState(proveedor?.domicilio ?? '')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const payload = {
      razon_social: razonSocial,
      cuit,
      domicilio: domicilio || null,
      telefono: telefono || null,
    }
    const { error } = proveedor
      ? await supabase.from('proveedores').update(payload).eq('id', proveedor.id)
      : await supabase.from('proveedores').insert(payload)
    setLoading(false)
    if (error) {
      setError('Error al guardar: ' + error.message)
      return
    }
    if (proveedor) {
      onGuardado?.()
    } else {
      setRazonSocial('')
      setCuit('')
      setDomicilio('')
      setTelefono('')
    }
    router.refresh()
  }

  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      <input type="text" placeholder="Razón social" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} required className={`flex-1 min-w-[200px] ${inputStyle}`} />
      <input type="text" placeholder="CUIT" value={cuit} onChange={(e) => setCuit(e.target.value)} required className={`w-40 ${inputStyle}`} />
      <input type="text" placeholder="Domicilio (opcional)" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className={`flex-1 min-w-[180px] ${inputStyle}`} />
      <input type="text" placeholder="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={`w-40 ${inputStyle}`} />
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : proveedor ? 'Guardar cambios' : 'Agregar'}
        </button>
        {proveedor && (
          <button type="button" onClick={() => onGuardado?.()} className="px-4 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </form>
  )
}
