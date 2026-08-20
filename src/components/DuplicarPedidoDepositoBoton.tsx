'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function DuplicarPedidoDepositoBoton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleClick = async () => {
    setLoading(true)

    const { data: origen } = await supabase.from('pedidos_deposito').select('*').eq('id', id).single()
    const { data: items } = await supabase.from('pedidos_deposito_items').select('*').eq('pedido_deposito_id', id)

    if (!origen) {
      setLoading(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const { data: nuevo, error: errInsert } = await supabase
      .from('pedidos_deposito')
      .insert({
        empresa_id: origen.empresa_id,
        cliente_id: origen.cliente_id,
        pedido_id: null, // pedido a depósito nuevo independiente, no arrastra el pedido de origen
        observaciones_generales: origen.observaciones_generales,
        lugar_envio_texto: origen.lugar_envio_texto,
        lugar_envio_alias: origen.lugar_envio_alias,
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
      const { error: errItemsInsert } = await supabase.from('pedidos_deposito_items').insert(
        items.map((i) => ({
          pedido_deposito_id: nuevo.id,
          pedido_compra_item_id: null, // pedido a depósito nuevo independiente
          articulo_id: i.articulo_id,
          cantidad: i.cantidad,
          observaciones: i.observaciones,
        }))
      )
      if (errItemsInsert) {
        setLoading(false)
        alert('El pedido se duplicó pero hubo un error al copiar las líneas: ' + errItemsInsert.message)
        router.push(`/pedidos-deposito/${nuevo.id}`)
        return
      }
    }

    setLoading(false)
    router.push(`/pedidos-deposito/${nuevo.id}`)
  }

  return (
    <button onClick={handleClick} disabled={loading} className="print:hidden px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
      {loading ? 'Duplicando...' : 'Duplicar'}
    </button>
  )
}
