'use client'

import { useState } from 'react'
import ProveedorForm from './ProveedorForm'
import ProveedoresTabla from './ProveedoresTabla'

type Proveedor = {
  id: string
  razon_social: string
  cuit: string
  domicilio: string | null
  telefono: string | null
  activo: boolean
}

export default function ProveedoresPanel({ proveedores }: { proveedores: Proveedor[] }) {
  const [editando, setEditando] = useState<Proveedor | null>(null)

  return (
    <div>
      <ProveedorForm
        key={editando?.id ?? 'nuevo'}
        proveedor={editando ?? undefined}
        onGuardado={() => setEditando(null)}
      />
      <ProveedoresTabla proveedores={proveedores} onEditar={setEditando} />
    </div>
  )
}
