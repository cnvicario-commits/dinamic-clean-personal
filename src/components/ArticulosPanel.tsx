'use client'

import { useState } from 'react'
import ArticuloForm from './ArticuloForm'
import ArticulosTabla from './ArticulosTabla'

type Articulo = {
  id: string
  codigo_interno: string
  nombre: string
  categoria: string | null
  unidad: string | null
  activo: boolean
  proveedor_habitual_id: string | null
}

type ProveedorResumen = { id: string; razon_social: string }

export default function ArticulosPanel({
  articulos,
  proveedores,
}: {
  articulos: Articulo[]
  proveedores: ProveedorResumen[]
}) {
  const [editando, setEditando] = useState<Articulo | null>(null)

  return (
    <div>
      <ArticuloForm
        key={editando?.id ?? 'nuevo'}
        articulo={editando ?? undefined}
        proveedores={proveedores}
        onGuardado={() => setEditando(null)}
      />
      <ArticulosTabla articulos={articulos} proveedores={proveedores} onEditar={setEditando} />
    </div>
  )
}
