'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function DuplicarOrdenCompraBoton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleClick = async () => {
    setLoading(true)

    const { data: origen } = await supabase.from('ordenes_compra').select('*').eq('id', id).single()
    const { data: items } = await supabase.from('ordenes_compra_items').select('*').eq('oc_id', id)

    if (!origen) {
      setLoading(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const { data: nuevo, error: errInsert } = await supabase
      .from('ordenes_compra')
      .insert({
        empresa_id: origen.empresa_id,
        proveedor_id: origen.proveedor_id,
        cliente_id: origen.cliente_id,
        pedido_id: null, // OC nueva independiente, no arrastra el pedido de origen
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
      await supabase.from('ordenes_compra_items').insert(
        items.map((i) => ({
          oc_id: nuevo.id,
          pedido_compra_item_id: null, // OC nueva independiente, no arrastra el origen
          articulo_id: i.articulo_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          observaciones: i.observaciones,
        }))
      )
    }

    setLoading(false)
    router.push(`/ordenes-compra/${nuevo.id}`)
  }

  return (
    <button onClick={handleClick} disabled={loading} className="print:hidden px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
      {loading ? 'Duplicando...' : 'Duplicar'}
    </button>
  )
}
