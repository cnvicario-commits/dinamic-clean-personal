'use client'

import { useState } from 'react'
import ClienteDomicilioForm from './ClienteDomicilioForm'
import ClienteDomiciliosTabla from './ClienteDomiciliosTabla'
import type { ClienteDomicilio } from '@/types/compras'

export default function ClienteDomiciliosPanel({
  clienteId,
  domicilios,
}: {
  clienteId: string
  domicilios: ClienteDomicilio[]
}) {
  const [editando, setEditando] = useState<ClienteDomicilio | null>(null)

  return (
    <div>
      <ClienteDomicilioForm
        key={editando?.id ?? 'nuevo'}
        clienteId={clienteId}
        domicilio={editando ?? undefined}
        onGuardado={() => setEditando(null)}
      />
      <ClienteDomiciliosTabla domicilios={domicilios} onEditar={setEditando} />
    </div>
  )
}
