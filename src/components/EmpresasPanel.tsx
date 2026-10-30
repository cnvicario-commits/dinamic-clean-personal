'use client'

import { useState } from 'react'
import EmpresaForm from './EmpresaForm'
import EmpresasTabla from './EmpresasTabla'
import type { Empresa } from '@/types/compras'

export default function EmpresasPanel({ empresas, canWrite }: { empresas: Empresa[]; canWrite: boolean }) {
  const [editando, setEditando] = useState<Empresa | null>(null)

  return (
    <div>
      {canWrite && (
        <EmpresaForm
          key={editando?.id ?? 'nuevo'}
          empresa={editando ?? undefined}
          onGuardado={() => setEditando(null)}
        />
      )}
      <EmpresasTabla empresas={empresas} canWrite={canWrite} onEditar={setEditando} />
    </div>
  )
}
