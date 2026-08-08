'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Empresa } from '@/types/compras'

export default function EmpresaForm({
  empresa,
  onGuardado,
}: {
  empresa?: Empresa
  onGuardado?: () => void
}) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? '')
  const [cuit, setCuit] = useState(empresa?.cuit ?? '')
  const [domicilio, setDomicilio] = useState(empresa?.domicilio ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const payload = {
      nombre,
      cuit,
      domicilio: domicilio || null,
    }
    const { error } = empresa
      ? await supabase.from('empresas').update(payload).eq('id', empresa.id)
      : await supabase.from('empresas').insert({ ...payload, activo: true })
    setLoading(false)
    if (error) {
      setError('Error al guardar: ' + error.message)
      return
    }
    if (empresa) {
      onGuardado?.()
    } else {
      setNombre('')
      setCuit('')
      setDomicilio('')
    }
    router.refresh()
  }

  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      <input type="text" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className={`flex-1 min-w-[200px] ${inputStyle}`} />
      <input type="text" placeholder="CUIT" value={cuit} onChange={(e) => setCuit(e.target.value)} required className={`w-40 ${inputStyle}`} />
      <input type="text" placeholder="Domicilio (opcional)" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className={`flex-1 min-w-[180px] ${inputStyle}`} />
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : empresa ? 'Guardar cambios' : 'Agregar'}
        </button>
        {empresa && (
          <button type="button" onClick={() => onGuardado?.()} className="px-4 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </form>
  )
}
