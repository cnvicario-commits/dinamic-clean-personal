'use client'

import { useState } from 'react'
import EmpresaForm from './EmpresaForm'
import EmpresasTabla from './EmpresasTabla'
import type { Empresa } from '@/types/compras'

export default function EmpresasPanel({ empresas }: { empresas: Empresa[] }) {
  const [editando, setEditando] = useState<Empresa | null>(null)

  return (
    <div>
      <EmpresaForm
        key={editando?.id ?? 'nuevo'}
        empresa={editando ?? undefined}
        onGuardado={() => setEditando(null)}
      />
      <EmpresasTabla empresas={empresas} onEditar={setEditando} />
    </div>
  )
}
