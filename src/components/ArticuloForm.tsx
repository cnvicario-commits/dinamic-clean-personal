'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

type Articulo = {
  id: string
  codigo_interno: string
  nombre: string
  categoria: string | null
  unidad: string | null
  proveedor_habitual_id: string | null
}

type ProveedorResumen = { id: string; razon_social: string }

export default function ArticuloForm({
  articulo,
  nombreSugerido,
  proveedores = [],
  onGuardado,
  onCreated,
}: {
  articulo?: Articulo
  nombreSugerido?: string
  proveedores?: ProveedorResumen[]
  onGuardado?: () => void
  onCreated?: (articuloId: string) => void
}) {
  const [nombre, setNombre] = useState(articulo?.nombre ?? nombreSugerido ?? '')
  const [categoria, setCategoria] = useState(articulo?.categoria ?? '')
  const [unidad, setUnidad] = useState(articulo?.unidad ?? '')
  const [proveedorHabitualId, setProveedorHabitualId] = useState(articulo?.proveedor_habitual_id ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const payload = {
      nombre,
      categoria: categoria || null,
      unidad: unidad || null,
      proveedorHabitualId: proveedorHabitualId || null,
    }

    if (articulo) {
      try { const api=await createAuthenticatedBrowserApiClient(); await api.updateArticle(articulo.id,payload) } catch(err) { setLoading(false);setError('Error al guardar: '+(err instanceof Error?err.message:'Error inesperado'));return }
      setLoading(false)
      onGuardado?.()
      router.refresh()
      return
    }

    let data: { id: string } | null = null
    try { data=await (await createAuthenticatedBrowserApiClient()).createArticle(payload) } catch(err) { setLoading(false);setError('Error al guardar: '+(err instanceof Error?err.message:'Error inesperado'));return }
    setLoading(false)
    if (onCreated && data) {
      onCreated(data.id)
    } else {
      setNombre('')
      setCategoria('')
      setUnidad('')
      setProveedorHabitualId('')
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
      <select value={proveedorHabitualId} onChange={(e) => setProveedorHabitualId(e.target.value)} className={`w-48 ${inputStyle}`}>
        <option value="">Sin proveedor habitual</option>
        {proveedores.map((p) => (
          <option key={p.id} value={p.id}>{p.razon_social}</option>
        ))}
      </select>
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
