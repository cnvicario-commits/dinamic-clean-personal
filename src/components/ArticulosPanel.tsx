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
}

export default function ArticulosPanel({ articulos }: { articulos: Articulo[] }) {
  const [editando, setEditando] = useState<Articulo | null>(null)

  return (
    <div>
      <ArticuloForm
        key={editando?.id ?? 'nuevo'}
        articulo={editando ?? undefined}
        onGuardado={() => setEditando(null)}
      />
      <ArticulosTabla articulos={articulos} onEditar={setEditando} />
    </div>
  )
}
