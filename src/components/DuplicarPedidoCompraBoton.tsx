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

    const { data: origen, error: errOrigen } = await supabase.from('pedidos_compra').select('*').eq('id', id).single()
    if (errOrigen || !origen) {
      setLoading(false)
      alert('Error al leer el pedido original: ' + (errOrigen?.message ?? 'no encontrado'))
      return
    }

    const { data: items, error: errItemsSelect } = await supabase
      .from('pedidos_compra_items')
      .select('*')
      .eq('pedido_id', id)
    if (errItemsSelect) {
      setLoading(false)
      alert('Error al leer las líneas del pedido original: ' + errItemsSelect.message)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const { data: nuevo, error: errInsert } = await supabase
      .from('pedidos_compra')
      .insert({
        empresa_id: origen.empresa_id,
        cliente_id: origen.cliente_id,
        observaciones_generales: origen.observaciones_generales,
        // Mismo lugar de envío que el pedido original, congelado igual que
        // en el alta manual (antes no se copiaba y se perdía al duplicar).
        lugar_envio_empresa: origen.lugar_envio_empresa,
        lugar_envio_domicilio_id: origen.lugar_envio_domicilio_id,
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
      const { error: errItemsInsert } = await supabase.from('pedidos_compra_items').insert(
        items.map((i) => ({
          pedido_id: nuevo.id,
          articulo_id: i.articulo_id,
          cantidad: i.cantidad,
          observaciones: i.observaciones,
        }))
      )
      if (errItemsInsert) {
        setLoading(false)
        // El pedido ya se creó: igual navegamos para no dejarlo huérfano,
        // pero avisamos que las líneas no se copiaron para que se carguen a mano.
        alert('El pedido se duplicó pero hubo un error al copiar las líneas: ' + errItemsInsert.message)
        router.push(`/pedidos-compra/${nuevo.id}`)
        return
      }
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
