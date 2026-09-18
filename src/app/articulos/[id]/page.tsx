import type { ComponentProps } from 'react'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import ArticuloProveedoresTabla from '@/components/ArticuloProveedoresTabla'

export default async function ArticuloDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: articulo } = await supabase
    .from('articulos')
    .select('*')
    .eq('id', id)
    .single()

  if (!articulo) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Artículo no encontrado.</p>
        <Link href="/articulos" className="text-teal-600 hover:underline text-sm">
          ← Volver a artículos
        </Link>
      </div>
    )
  }

  const { data: vinculos } = await supabase
    .from('articulos_proveedor')
    .select('id, codigo_proveedor, nombre_proveedor, precio, fecha_actualizacion, activo, proveedores(id, razon_social)')
    .eq('articulo_id', id)
    .order('precio')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/articulos" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a artículos
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{articulo.nombre}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Código interno: <span className="font-medium text-slate-700">{articulo.codigo_interno}</span>
        {articulo.categoria && <> · Categoría: {articulo.categoria}</>}
        {articulo.unidad && <> · Unidad: {articulo.unidad}</>}
      </p>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Proveedores ({vinculos?.length ?? 0})
      </h2>
      <ArticuloProveedoresTabla
        vinculos={(vinculos ?? []) as ComponentProps<typeof ArticuloProveedoresTabla>['vinculos']}
      />
    </div>
  )
}
