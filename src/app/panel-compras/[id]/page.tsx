import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import Link from 'next/link'
import PanelComprasAsignacion from '@/components/PanelComprasAsignacion'
import type {
  LineaPendiente,
  PedidoCompraDetalleView,
  PedidoCompraItemConArticulo,
} from '@/types/compras'

export default async function PanelComprasDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const api=await createAuthenticatedServerApiClient()
  const pedido = (await api.getPurchaseRequest(id).catch(() => null)) as PedidoCompraDetalleView | null

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
  const catalogs=await api.getPurchaseCatalogs()

  const lineas: LineaPendiente[] = items.map((i) => {
    const assigned=i as typeof i&{cantidad_asignada_oc:number;cantidad_asignada_deposito:number}
    const oc = Number(assigned.cantidad_asignada_oc??0)
    const dep = Number(assigned.cantidad_asignada_deposito??0)
    return {
      ...i,
      cantidad_asignada_oc: oc,
      cantidad_asignada_deposito: dep,
      // Una línea descartada cuenta como resuelta: no queda pendiente de
      // asignar, aunque su cantidad original nunca se haya cubierto.
      cantidad_pendiente: i.descartada ? 0 : i.cantidad - oc - dep,
    }
  })

  // Lugar de envío sugerido por el pedido de compra: se propone por defecto
  // al generar la OC, pero se puede cambiar en el propio selector.
  const lugarEnvioDefault = pedido.lugar_envio_empresa
    ? 'empresa'
    : pedido.lugar_envio_domicilio_id
      ? `domicilio:${pedido.lugar_envio_domicilio_id}`
      : ''

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
        empresaNombre={pedido.empresas?.nombre ?? null}
        empresaDomicilio={pedido.empresas?.domicilio ?? null}
        domicilios={catalogs.domicilios.filter(d=>d.cliente_id===pedido.cliente_id)}
        lugarEnvioDefault={lugarEnvioDefault}
        lineas={lineas}
        proveedores={catalogs.proveedores}
        preciosProveedor={catalogs.preciosProveedor}
      />
    </div>
  )
}
