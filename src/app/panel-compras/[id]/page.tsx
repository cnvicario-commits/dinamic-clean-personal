import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import PanelComprasAsignacion from '@/components/PanelComprasAsignacion'
import type { LineaPendiente, PedidoCompraItemConArticulo } from '@/types/compras'

export default async function PanelComprasDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from('pedidos_compra')
    .select(
      '*, empresas(id, nombre, cuit, domicilio), clientes(id, nombre), pedidos_compra_items(*, articulos(id, codigo_interno, nombre, unidad))'
    )
    .eq('id', id)
    .single()

  if (!pedido) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Pedido no encontrado.</p>
        <Link href="/panel-compras" className="text-teal-600 hover:underline text-sm">
          ← Volver al panel de compras
        </Link>
      </div>
    )
  }

  if (pedido.estado !== 'enviada') {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">
          Este pedido está en estado &quot;{pedido.estado}&quot;, solo se pueden procesar pedidos enviados.
        </p>
        <Link href="/panel-compras" className="text-teal-600 hover:underline text-sm">
          ← Volver al panel de compras
        </Link>
      </div>
    )
  }

  const items = (pedido.pedidos_compra_items ?? []) as PedidoCompraItemConArticulo[]
  const itemIds = items.map((i) => i.id)
  const articuloIds = [...new Set(items.map((i) => i.articulo_id))]

  const [{ data: filasOc }, { data: filasDeposito }, { data: proveedores }, { data: preciosProveedor }] =
    await Promise.all([
      itemIds.length > 0
        ? supabase.from('ordenes_compra_items').select('pedido_compra_item_id, cantidad').in('pedido_compra_item_id', itemIds)
        : Promise.resolve({ data: [] as { pedido_compra_item_id: string | null; cantidad: number }[] }),
      itemIds.length > 0
        ? supabase.from('pedidos_deposito_items').select('pedido_compra_item_id, cantidad').in('pedido_compra_item_id', itemIds)
        : Promise.resolve({ data: [] as { pedido_compra_item_id: string | null; cantidad: number }[] }),
      supabase.from('proveedores').select('id, razon_social').eq('activo', true).order('razon_social'),
      articuloIds.length > 0
        ? supabase.from('articulos_proveedor').select('articulo_id, proveedor_id, precio').eq('activo', true).in('articulo_id', articuloIds)
        : Promise.resolve({ data: [] as { articulo_id: string; proveedor_id: string; precio: number }[] }),
    ])

  const asignadoOc = new Map<string, number>()
  for (const fila of filasOc ?? []) {
    if (!fila.pedido_compra_item_id) continue
    asignadoOc.set(fila.pedido_compra_item_id, (asignadoOc.get(fila.pedido_compra_item_id) ?? 0) + fila.cantidad)
  }
  const asignadoDeposito = new Map<string, number>()
  for (const fila of filasDeposito ?? []) {
    if (!fila.pedido_compra_item_id) continue
    asignadoDeposito.set(fila.pedido_compra_item_id, (asignadoDeposito.get(fila.pedido_compra_item_id) ?? 0) + fila.cantidad)
  }

  const lineas: LineaPendiente[] = items.map((i) => {
    const oc = asignadoOc.get(i.id) ?? 0
    const dep = asignadoDeposito.get(i.id) ?? 0
    return {
      ...i,
      cantidad_asignada_oc: oc,
      cantidad_asignada_deposito: dep,
      cantidad_pendiente: i.cantidad - oc - dep,
    }
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link href="/panel-compras" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver al panel de compras
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{pedido.numero_pedido}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Empresa: <span className="font-medium text-slate-700">{pedido.empresas?.nombre}</span>
        {' · '}Cliente: <span className="font-medium text-slate-700">{pedido.clientes?.nombre}</span>
      </p>

      <PanelComprasAsignacion
        pedidoId={pedido.id}
        empresaId={pedido.empresa_id}
        clienteId={pedido.cliente_id}
        lineas={lineas}
        proveedores={proveedores ?? []}
        preciosProveedor={preciosProveedor ?? []}
      />
    </div>
  )
}
