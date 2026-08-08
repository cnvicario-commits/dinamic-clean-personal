'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function DuplicarPedidoCompraBoton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleClick = async () => {
    setLoading(true)

    const { data: origen } = await supabase.from('pedidos_compra').select('*').eq('id', id).single()
    const { data: items } = await supabase.from('pedidos_compra_items').select('*').eq('pedido_id', id)

    if (!origen) {
      setLoading(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const { data: nuevo, error: errInsert } = await supabase
      .from('pedidos_compra')
      .insert({
        empresa_id: origen.empresa_id,
        cliente_id: origen.cliente_id,
        observaciones_generales: origen.observaciones_generales,
        estado: 'borrador',
        creado_por: userData.user?.id,
      })
      .select('id')
      .single()

    if (errInsert || !nuevo) {
      setLoading(false)
      alert('Error al duplicar: ' + (errInsert?.message ?? 'desconocido'))
      return
    }

    if (items && items.length > 0) {
      await supabase.from('pedidos_compra_items').insert(
        items.map((i) => ({
          pedido_id: nuevo.id,
          articulo_id: i.articulo_id,
          cantidad: i.cantidad,
          observaciones: i.observaciones,
        }))
      )
    }

    setLoading(false)
    router.push(`/pedidos-compra/${nuevo.id}`)
  }

  return (
    <button onClick={handleClick} disabled={loading} className="text-teal-600 hover:underline text-sm disabled:opacity-50">
      {loading ? 'Duplicando...' : 'Duplicar'}
    </button>
  )
}
