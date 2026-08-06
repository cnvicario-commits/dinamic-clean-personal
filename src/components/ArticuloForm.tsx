'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Articulo = {
  id: string
  codigo_interno: string
  nombre: string
  categoria: string | null
  unidad: string | null
}

export default function ArticuloForm({
  articulo,
  nombreSugerido,
  onGuardado,
  onCreated,
}: {
  articulo?: Articulo
  nombreSugerido?: string
  onGuardado?: () => void
  onCreated?: (articuloId: string) => void
}) {
  const [nombre, setNombre] = useState(articulo?.nombre ?? nombreSugerido ?? '')
  const [categoria, setCategoria] = useState(articulo?.categoria ?? '')
  const [unidad, setUnidad] = useState(articulo?.unidad ?? '')
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
      categoria: categoria || null,
      unidad: unidad || null,
    }

    if (articulo) {
      const { error } = await supabase.from('articulos').update(payload).eq('id', articulo.id)
      setLoading(false)
      if (error) {
        setError('Error al guardar: ' + error.message)
        return
      }
      onGuardado?.()
      router.refresh()
      return
    }

    // Alta: no se envía codigo_interno, lo completa el trigger en Supabase.
    const { data, error } = await supabase.from('articulos').insert(payload).select().single()
    setLoading(false)
    if (error) {
      setError('Error al guardar: ' + error.message)
      return
    }
    if (onCreated && data) {
      onCreated(data.id)
    } else {
      setNombre('')
      setCategoria('')
      setUnidad('')
    }
    router.refresh()
  }

  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      {articulo && (
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Código interno</label>
          <input type="text" value={articulo.codigo_interno} disabled className={`w-32 bg-slate-50 text-slate-500 ${inputStyle}`} />
        </div>
      )}
      <input type="text" placeholder="Nombre del artículo" value={nombre} onChange={(e) => setNombre(e.target.value)} required className={`flex-1 min-w-[200px] ${inputStyle}`} />
      <input type="text" placeholder="Categoría (opcional)" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`w-40 ${inputStyle}`} />
      <input type="text" placeholder="Unidad (ej: unidad, pack, litro)" value={unidad} onChange={(e) => setUnidad(e.target.value)} className={`w-48 ${inputStyle}`} />
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : articulo ? 'Guardar cambios' : 'Agregar'}
        </button>
        {articulo && (
          <button type="button" onClick={() => onGuardado?.()} className="px-4 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </form>
  )
}
