import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import PedidoDepositoDetalle from '@/components/PedidoDepositoDetalle'
import type { PedidoDepositoDetalleView } from '@/types/compras'

export default async function PedidoDepositoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from('pedidos_deposito')
    .select(
      '*, empresas(*), clientes(id, nombre), pedidos_deposito_items(*, articulos(id, codigo_interno, nombre, unidad))'
    )
    .eq('id', id)
    .single()

  if (!pedido) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Pedido a depósito no encontrado.</p>
        <Link href="/pedidos-deposito" className="text-teal-600 hover:underline text-sm">
          ← Volver a pedidos a depósito
        </Link>
      </div>
    )
  }

  const pedidoView = pedido as unknown as PedidoDepositoDetalleView

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
      <Link href="/pedidos-deposito" className="text-teal-600 hover:underline text-sm mb-4 inline-block print:hidden">
        ← Volver a pedidos a depósito
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6 print:hidden">{pedidoView.numero_pedido_deposito}</h1>
      <PedidoDepositoDetalle pedido={pedidoView} />
    </div>
  )
}
