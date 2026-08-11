import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import PedidoCompraForm from '@/components/PedidoCompraForm'
import PedidoCompraDetalle from '@/components/PedidoCompraDetalle'
import EstadoBadge from '@/components/EstadoBadge'
import EstadoPedidoCompraBoton from '@/components/EstadoPedidoCompraBoton'
import type { PedidoCompraDetalleView } from '@/types/compras'

export default async function PedidoCompraDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from('pedidos_compra')
    .select(
      '*, empresas(*), clientes(id, nombre), cliente_domicilios(alias, direccion), pedidos_compra_items(*, articulos(id, codigo_interno, nombre, unidad, categoria))'
    )
    .eq('id', id)
    .single()

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
    const [{ data: empresas }, { data: clientes }, { data: articulos }, { data: domicilios }] = await Promise.all([
      supabase.from('empresas').select('id, nombre, domicilio').eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id, nombre').order('nombre'),
      supabase.from('articulos').select('id, codigo_interno, nombre, unidad, categoria').eq('activo', true).order('nombre'),
      supabase.from('cliente_domicilios').select('id, cliente_id, alias, direccion, es_principal, activo').eq('activo', true).order('alias'),
    ])

    return (
      <div className="max-w-4xl mx-auto px-6 py-10 print:hidden">
        <Link href="/pedidos-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
          ← Volver a pedidos de compra
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{pedidoView.numero_pedido}</h1>
            <EstadoBadge estado={pedidoView.estado} />
          </div>
          <EstadoPedidoCompraBoton id={pedidoView.id} />
        </div>
        <PedidoCompraForm
          empresas={empresas ?? []}
          clientes={clientes ?? []}
          articulos={articulos ?? []}
          domicilios={domicilios ?? []}
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
