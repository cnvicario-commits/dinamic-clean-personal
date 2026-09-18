'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { type RelOne, relOne } from '@/lib/supabase-rel'
import BuscadorArticulo from './BuscadorArticulo'
import ArticuloForm from './ArticuloForm'

type Articulo = { id: string; codigo_interno: string; nombre: string }

type Sugerencia = { articulo_id: string; codigo_interno: string; nombre: string; similitud: number }

type Pendiente = {
  id: string
  codigo_proveedor: string | null
  nombre_proveedor: string | null
  precio: number | null
  archivo_origen: string | null
  motivo: string | null
  sugerencias: Sugerencia[] | null
  created_at: string
  proveedores: RelOne<{ id: string; razon_social: string }>
}

export default function PendientesTabla({
  pendientes,
  articulos,
}: {
  pendientes: Pendiente[]
  articulos: Articulo[]
}) {
  if (pendientes.length === 0) {
    return <p className="text-slate-500 text-sm">No hay líneas pendientes por resolver.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {pendientes.map((p) => (
        <FilaPendiente key={p.id} pendiente={p} articulos={articulos} />
      ))}
    </div>
  )
}

function FilaPendiente({ pendiente, articulos }: { pendiente: Pendiente; articulos: Articulo[] }) {
  const [modo, setModo] = useState<'vincular' | 'crear' | null>(null)
  const [articuloElegido, setArticuloElegido] = useState<Articulo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function vincular(articuloId: string) {
    setLoading(true)
    setError('')
    const proveedor = relOne(pendiente.proveedores)
    const { error: insertError } = await supabase.from('articulos_proveedor').insert({
      articulo_id: articuloId,
      proveedor_id: proveedor?.id,
      codigo_proveedor: pendiente.codigo_proveedor,
      nombre_proveedor: pendiente.nombre_proveedor,
      precio: pendiente.precio,
      fecha_actualizacion: new Date().toISOString(),
    })
    if (insertError) {
      setLoading(false)
      setError(
        'Error al vincular: ' + insertError.message + ' (¿ya existe un vínculo con ese código para este proveedor?)'
      )
      return
    }
    const { error: updateError } = await supabase
      .from('articulos_proveedor_pendientes')
      .update({ resuelto: true })
      .eq('id', pendiente.id)
    setLoading(false)
    if (updateError) {
      setError('Se vinculó pero no se pudo marcar como resuelto: ' + updateError.message)
      return
    }
    router.refresh()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-slate-800 font-medium">{pendiente.nombre_proveedor || 'Sin descripción'}</p>
          <p className="text-sm text-slate-500">
            {relOne(pendiente.proveedores)?.razon_social ?? 'Proveedor desconocido'} · Código: {pendiente.codigo_proveedor || 'sin código'} · Precio: {pendiente.precio ?? '-'}
            {pendiente.archivo_origen && <> · Archivo: {pendiente.archivo_origen}</>}
          </p>
          {pendiente.motivo && (
            <p className="text-sm text-amber-600 mt-1">{pendiente.motivo}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModo(modo === 'vincular' ? null : 'vincular')}
            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
          >
            Vincular a artículo existente
          </button>
          <button
            onClick={() => setModo(modo === 'crear' ? null : 'crear')}
            className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
          >
            Crear artículo nuevo
          </button>
        </div>
      </div>

      {pendiente.sugerencias && pendiente.sugerencias.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-slate-500">¿Es alguno de estos?</p>
          {pendiente.sugerencias.map((s) => (
            <button
              key={s.articulo_id}
              onClick={() => vincular(s.articulo_id)}
              disabled={loading}
              className="text-left px-3 py-2 text-sm bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg border border-teal-200 disabled:opacity-50"
            >
              {s.codigo_interno} — {s.nombre}{' '}
              <span className="text-teal-600 font-medium">({Math.round(s.similitud * 100)}% similar)</span>
            </button>
          ))}
        </div>
      )}

      {modo === 'vincular' && (
        <div className="mt-4 flex flex-wrap gap-2 items-start">
          <div className="flex-1 min-w-[240px]">
            <BuscadorArticulo articulos={articulos} onSeleccionar={setArticuloElegido} />
          </div>
          <button
            onClick={() => articuloElegido && vincular(articuloElegido.id)}
            disabled={!articuloElegido || loading}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Vinculando...' : 'Vincular'}
          </button>
        </div>
      )}

      {modo === 'crear' && (
        <div className="mt-4">
          <ArticuloForm
            nombreSugerido={pendiente.nombre_proveedor ?? ''}
            onCreated={(articuloId) => vincular(articuloId)}
          />
        </div>
      )}

      {error && <p className="text-rose-600 text-sm mt-2">{error}</p>}
    </div>
  )
}
