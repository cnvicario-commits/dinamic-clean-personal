'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { EstadoOrdenCompra } from '@/types/compras'

const SIGUIENTE: Partial<Record<EstadoOrdenCompra, { estado: EstadoOrdenCompra; etiqueta: string }>> = {
  borrador: { estado: 'enviada', etiqueta: 'Marcar como enviada' },
  enviada: { estado: 'recepcionada', etiqueta: 'Marcar como recepcionada' },
}

export default function EstadoOrdenCompraBoton({ id, estado }: { id: string; estado: EstadoOrdenCompra }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const siguiente = SIGUIENTE[estado]
  if (!siguiente) return null

  const handleClick = async () => {
    setLoading(true)
    await supabase.from('ordenes_compra').update({ estado: siguiente.estado }).eq('id', id)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="print:hidden px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? 'Guardando...' : siguiente.etiqueta}
    </button>
  )
}
