import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import Link from 'next/link'
import PedidoCompraForm from '@/components/PedidoCompraForm'
import PedidoCompraDetalle from '@/components/PedidoCompraDetalle'
import EstadoBadge from '@/components/EstadoBadge'
import type { PedidoCompraDetalleView } from '@/types/compras'

export default async function PedidoCompraDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const api=await createAuthenticatedServerApiClient()
  const pedido=await api.getPurchaseRequest(id).catch(()=>null)

  if (!pedido) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Pedido no encontrado.</p>
        <Link href="/pedidos-compra" className="text-teal-600 hover:underline text-sm">
          ← Volver a pedidos de compra
        </Link>
      </div>
    )
  }

  const pedidoView = pedido as unknown as PedidoCompraDetalleView

  if (pedidoView.estado === 'borrador') {
    const {empresas,clientes,articulos,domicilios}=await api.getPurchaseCatalogs()

    return (
      <div className="max-w-4xl mx-auto px-6 py-10 print:hidden">
        <Link href="/pedidos-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
          ← Volver a pedidos de compra
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{pedidoView.numero_pedido}</h1>
          <EstadoBadge estado={pedidoView.estado} />
        </div>
        <PedidoCompraForm
          empresas={empresas} clientes={clientes} articulos={articulos} domicilios={domicilios}
          pedido={pedidoView}
          items={pedidoView.pedidos_compra_items}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
      <Link href="/pedidos-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block print:hidden">
        ← Volver a pedidos de compra
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6 print:hidden">{pedidoView.numero_pedido}</h1>
      <PedidoCompraDetalle pedido={pedidoView} />
    </div>
  )
}
