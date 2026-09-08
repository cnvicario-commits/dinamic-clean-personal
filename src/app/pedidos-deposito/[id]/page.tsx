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
      '*, empresas(*), clientes(id, nombre), pedidos_deposito_items(*, articulos(id, codigo_interno, nombre, unidad, categoria, proveedor_habitual_id)), pedidos_compra(numero_pedido)'
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

  // Precio de referencia por artículo (articulos_proveedor.precio del
  // proveedor habitual), solo para mostrar en pantalla: pedidos_deposito_items
  // no tiene precio_unitario porque no es una compra a un proveedor. Se
  // resuelve con una consulta aparte, igual que codigoPorArticulo en
  // ordenes-compra/[id]/page.tsx.
  type ItemDeposito = { articulo_id: string; articulos: { proveedor_habitual_id: string | null } | null }
  type ParProveedorArticulo = { proveedorId: string; articuloId: string }
  const paresProveedorArticulo: ParProveedorArticulo[] = (pedido.pedidos_deposito_items ?? [])
    .map((i: ItemDeposito) => ({ proveedorId: i.articulos?.proveedor_habitual_id ?? null, articuloId: i.articulo_id }))
    .filter((p: { proveedorId: string | null; articuloId: string }): p is ParProveedorArticulo => p.proveedorId !== null)
  const proveedorHabitualIds = [...new Set(paresProveedorArticulo.map((p: ParProveedorArticulo) => p.proveedorId))]
  const articuloIds = [...new Set(paresProveedorArticulo.map((p: ParProveedorArticulo) => p.articuloId))]

  let precioPorArticulo = new Map<string, number>()
  if (proveedorHabitualIds.length > 0) {
    const { data: preciosProveedor } = await supabase
      .from('articulos_proveedor')
      .select('articulo_id, proveedor_id, precio')
      .in('proveedor_id', proveedorHabitualIds)
      .in('articulo_id', articuloIds)
    precioPorArticulo = new Map(
      (preciosProveedor ?? [])
        .filter((p) => paresProveedorArticulo.some((par: ParProveedorArticulo) => par.proveedorId === p.proveedor_id && par.articuloId === p.articulo_id))
        .map((p) => [p.articulo_id, p.precio])
    )
  }

  const pedidoView = {
    ...pedido,
    pedidos_deposito_items: (pedido.pedidos_deposito_items ?? []).map((i: ItemDeposito & { articulo_id: string }) => ({
      ...i,
      precio_referencia: precioPorArticulo.get(i.articulo_id) ?? null,
    })),
  } as unknown as PedidoDepositoDetalleView

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
      <Link href="/pedidos-deposito" className="text-teal-600 hover:underline text-sm mb-4 inline-block print:hidden">
        ← Volver a pedidos a depósito
      </Link>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Pedido a depósito</h1>
        <span className="text-lg font-semibold text-slate-600">{pedidoView.numero_pedido_deposito}</span>
      </div>
      <PedidoDepositoDetalle pedido={pedidoView} />
    </div>
  )
}
