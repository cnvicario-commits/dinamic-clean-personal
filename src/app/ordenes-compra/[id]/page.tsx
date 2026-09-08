import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import OrdenCompraDetalle from '@/components/OrdenCompraDetalle'
import type { OrdenCompraDetalleView } from '@/types/compras'

export default async function OrdenCompraDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: orden } = await supabase
    .from('ordenes_compra')
    .select(
      '*, empresas(*), proveedores(id, razon_social, domicilio, provincia, condicion_pago_default), clientes(id, nombre), ordenes_compra_items(*, articulos(id, codigo_interno, nombre, unidad, categoria)), pedidos_compra(numero_pedido)'
    )
    .eq('id', id)
    .single()

  if (!orden) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Orden de compra no encontrada.</p>
        <Link href="/ordenes-compra" className="text-teal-600 hover:underline text-sm">
          ← Volver a órdenes de compra
        </Link>
      </div>
    )
  }

  // Código que el proveedor de esta OC usa para cada artículo. No es un join
  // real (articulos_proveedor no tiene FK hacia ordenes_compra_items): se
  // resuelve con una consulta aparte filtrada por el proveedor_id de la OC,
  // igual que preciosProveedor en OrdenCompraForm.
  const articuloIds = (orden.ordenes_compra_items ?? []).map((i: { articulo_id: string }) => i.articulo_id)
  const { data: codigosProveedor } = await supabase
    .from('articulos_proveedor')
    .select('articulo_id, codigo_proveedor')
    .eq('proveedor_id', orden.proveedor_id)
    .in('articulo_id', articuloIds)
  const codigoPorArticulo = new Map((codigosProveedor ?? []).map((c) => [c.articulo_id, c.codigo_proveedor]))

  const ordenView = {
    ...orden,
    ordenes_compra_items: (orden.ordenes_compra_items ?? []).map((i: { articulo_id: string }) => ({
      ...i,
      codigo_proveedor: codigoPorArticulo.get(i.articulo_id) ?? null,
    })),
  } as unknown as OrdenCompraDetalleView

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
      <Link href="/ordenes-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block print:hidden">
        ← Volver a órdenes de compra
      </Link>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Orden de compra</h1>
        <span className="text-lg font-semibold text-slate-600">{ordenView.numero_oc}</span>
      </div>
      <OrdenCompraDetalle orden={ordenView} />
    </div>
  )
}
