import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import ImprimirOrdenesCompraLote from '@/components/ImprimirOrdenesCompraLote'
import type { OrdenCompraDetalleView } from '@/types/compras'

export default async function ImprimirOrdenesCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids: idsParam } = await searchParams
  const ids = (idsParam ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  if (ids.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">No se seleccionó ninguna orden de compra.</p>
        <Link href="/ordenes-compra" className="text-teal-600 hover:underline text-sm">
          ← Volver a órdenes de compra
        </Link>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: ordenes } = await supabase
    .from('ordenes_compra')
    .select(
      '*, empresas(*), proveedores(id, razon_social, domicilio, provincia, condicion_pago_default), clientes(id, nombre), ordenes_compra_items(*, articulos(id, codigo_interno, nombre, unidad, categoria)), pedidos_compra(numero_pedido)'
    )
    .in('id', ids)

  // Código que cada proveedor usa para cada artículo (ver comentario
  // análogo en ordenes-compra/[id]/page.tsx). Acá puede haber varios
  // proveedores a la vez (una OC por fila seleccionada), por eso se busca
  // por par proveedor+artículo en vez de un único proveedor_id.
  const proveedorIds = [...new Set((ordenes ?? []).map((o) => o.proveedor_id))]
  const articuloIds = [
    ...new Set((ordenes ?? []).flatMap((o) => (o.ordenes_compra_items ?? []).map((i: { articulo_id: string }) => i.articulo_id))),
  ]
  const { data: codigosProveedor } = await supabase
    .from('articulos_proveedor')
    .select('articulo_id, proveedor_id, codigo_proveedor')
    .in('proveedor_id', proveedorIds)
    .in('articulo_id', articuloIds)
  const codigoPorProveedorYArticulo = new Map(
    (codigosProveedor ?? []).map((c) => [`${c.proveedor_id}_${c.articulo_id}`, c.codigo_proveedor])
  )

  // Se reordena según el orden de `ids` (el orden en que se tildaron en el
  // listado), ya que `.in()` no garantiza devolver las filas en ese orden.
  const ordenesConCodigo = (ordenes ?? []).map((o) => ({
    ...o,
    ordenes_compra_items: (o.ordenes_compra_items ?? []).map((i: { articulo_id: string }) => ({
      ...i,
      codigo_proveedor: codigoPorProveedorYArticulo.get(`${o.proveedor_id}_${i.articulo_id}`) ?? null,
    })),
  }))
  const mapa = new Map(ordenesConCodigo.map((o) => [o.id, o]))
  const ordenadas = ids.map((id) => mapa.get(id)).filter((o): o is NonNullable<typeof o> => Boolean(o))

  const fechaCompacta = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 print:px-0 print:py-0 print:max-w-none">
      <Link href="/ordenes-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block print:hidden">
        ← Volver a órdenes de compra
      </Link>
      <ImprimirOrdenesCompraLote
        ordenes={ordenadas as unknown as OrdenCompraDetalleView[]}
        nombreArchivo={`ordenes_compra_${fechaCompacta}`}
      />
    </div>
  )
}
