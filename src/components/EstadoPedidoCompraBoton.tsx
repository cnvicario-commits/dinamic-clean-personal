'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function EstadoPedidoCompraBoton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleClick = async () => {
    if (!confirm('¿Marcar este pedido como enviado? Ya no se va a poder editar.')) return
    setLoading(true)
    await supabase.from('pedidos_compra').update({ estado: 'enviada' }).eq('id', id)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? 'Enviando...' : 'Marcar como enviada'}
    </button>
  )
}
