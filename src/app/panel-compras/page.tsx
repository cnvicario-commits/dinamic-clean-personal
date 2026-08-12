import { createClient } from '@/utils/supabase/server'
import PedidosEnviadosTabla from '@/components/PedidosEnviadosTabla'
import type { PedidoEnviado } from '@/types/compras'

export default async function PanelComprasPage() {
  const supabase = await createClient()
  const { data: pedidos } = await supabase
    .from('pedidos_compra')
    .select('*, empresas(nombre), clientes(nombre)')
    .eq('estado', 'enviada')
    .order('created_at', { ascending: false })

  const pedidoIds = (pedidos ?? []).map((p) => p.id)

  const { data: items } = pedidoIds.length > 0
    ? await supabase
        .from('pedidos_compra_items')
        .select('id, pedido_id, cantidad, descartada')
        .in('pedido_id', pedidoIds)
    : { data: [] as { id: string; pedido_id: string; cantidad: number; descartada: boolean }[] }

  const itemIds = (items ?? []).map((i) => i.id)

  const [{ data: filasOc }, { data: filasDeposito }] = await Promise.all([
    itemIds.length > 0
      ? supabase.from('ordenes_compra_items').select('pedido_compra_item_id, cantidad').in('pedido_compra_item_id', itemIds)
      : Promise.resolve({ data: [] as { pedido_compra_item_id: string | null; cantidad: number }[] }),
    itemIds.length > 0
      ? supabase.from('pedidos_deposito_items').select('pedido_compra_item_id, cantidad').in('pedido_compra_item_id', itemIds)
      : Promise.resolve({ data: [] as { pedido_compra_item_id: string | null; cantidad: number }[] }),
  ])

  // Acá no hace falta separar OC de depósito (a diferencia del detalle): el
  // listado solo necesita saber si cada línea ya quedó totalmente asignada.
  const asignado = new Map<string, number>()
  for (const fila of [...(filasOc ?? []), ...(filasDeposito ?? [])]) {
    if (!fila.pedido_compra_item_id) continue
    asignado.set(fila.pedido_compra_item_id, (asignado.get(fila.pedido_compra_item_id) ?? 0) + fila.cantidad)
  }

  const itemsPorPedido = new Map<string, { id: string; cantidad: number; descartada: boolean }[]>()
  for (const i of items ?? []) {
    itemsPorPedido.set(i.pedido_id, [...(itemsPorPedido.get(i.pedido_id) ?? []), i])
  }

  // Un pedido está "procesado" cuando tiene al menos una línea y todas están
  // descartadas o completamente asignadas. Un pedido sin líneas (anomalía de
  // datos) queda "pendiente" a propósito, para no desaparecer sin revisión.
  const pedidosConEstado: PedidoEnviado[] = (pedidos ?? []).map((p) => {
    const itemsDelPedido = itemsPorPedido.get(p.id) ?? []
    const procesado =
      itemsDelPedido.length > 0 &&
      itemsDelPedido.every((i) => i.descartada || i.cantidad - (asignado.get(i.id) ?? 0) <= 0)
    return { ...p, procesado }
  })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Panel de compras</h1>
      <PedidosEnviadosTabla pedidos={pedidosConEstado} />
    </div>
  )
}
