'use client'

import EstadoBadge from './EstadoBadge'
import BotonImprimir from './BotonImprimir'
import EstadoPedidoDepositoBoton from './EstadoPedidoDepositoBoton'
import DuplicarPedidoDepositoBoton from './DuplicarPedidoDepositoBoton'
import type { PedidoDepositoDetalleView } from '@/types/compras'

function formatearMoneda(valor: number) {
  return valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Campo de la grilla de datos (etiqueta arriba, valor abajo). Mismo patrón
// que OrdenCompraDetalle.tsx, para que ambos documentos se vean como el
// mismo formato de la app. `destacado` resalta el valor en negrita (usado
// para "Cliente"); `grande` además lo agranda, le pone fondo de color y
// ocupa las 2 columnas (usado para "Lugar de Entrega").
function CampoDato({
  etiqueta,
  valor,
  destacado,
  grande,
}: {
  etiqueta: string
  valor: string
  destacado?: boolean
  grande?: boolean
}) {
  return (
    <div className={grande ? 'col-span-2 bg-teal-50 rounded-md px-3 py-2' : 'px-3 py-1'}>
      <p className="text-xs text-slate-500">{etiqueta}</p>
      <p
        className={`text-sm text-slate-800 ${destacado || grande ? 'font-semibold' : ''} ${
          grande ? 'text-lg text-teal-800' : ''
        }`}
      >
        {valor}
      </p>
    </div>
  )
}

function formatearCliente(nombre: string, alias: string | null) {
  return alias ? `${nombre}-${alias}` : nombre
}

export default function PedidoDepositoDetalle({ pedido }: { pedido: PedidoDepositoDetalleView }) {
  // Mismo texto que la fila "Cliente" de la tabla de datos, agregado al
  // nombre del archivo descargado junto con el número de pedido.
  const clienteEtiqueta = pedido.clientes ? formatearCliente(pedido.clientes.nombre, pedido.lugar_envio_alias) : ''
  const nombreArchivo = clienteEtiqueta
    ? `${pedido.numero_pedido_deposito} - ${clienteEtiqueta}`
    : pedido.numero_pedido_deposito

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <EstadoBadge estado={pedido.estado} />
        <div className="flex gap-2">
          <EstadoPedidoDepositoBoton id={pedido.id} estado={pedido.estado} />
          <DuplicarPedidoDepositoBoton id={pedido.id} />
          <BotonImprimir nombreArchivo={nombreArchivo} />
        </div>
      </div>

      {/* 1. Encabezado: nombre de la empresa (sin logo) + N° del pedido de
          compra de origen arriba a la derecha, si vino de uno (el pedido que
          carga el supervisor y que el Panel de compras convierte en este
          pedido a depósito). Se ve tanto en pantalla como impreso: es lo que
          da trazabilidad hacia el pedido original una vez hecha la
          asignación. Mismo criterio que OrdenCompraDetalle.tsx. */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold text-slate-900">{pedido.empresas?.nombre}</h1>
        {pedido.pedidos_compra && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">Pedido de origen</p>
            <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">
              N° {pedido.pedidos_compra.numero_pedido}
            </p>
          </div>
        )}
      </div>

      {/* 2. N° de pedido a depósito */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Pedido a Depósito N° {pedido.numero_pedido_deposito}
        </p>
      </div>

      {/* 3. Banner destacado: lugar de entrega. */}
      {pedido.lugar_envio_alias && (
        <div
          className="bg-teal-600 text-white text-center py-5 px-4 rounded-lg mb-6 print:rounded-none"
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
        >
          <p className="text-3xl font-bold uppercase tracking-wide">{pedido.lugar_envio_alias}</p>
        </div>
      )}

      {/* 4. Grilla de datos: 2 columnas en vez de 1 fila por campo. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-white border border-slate-200 rounded-lg shadow-sm p-3 print:shadow-none print:border-black mb-6">
        <CampoDato etiqueta="Fecha" valor={new Date(`${pedido.fecha}T00:00:00`).toLocaleDateString('es-AR')} />
        <CampoDato etiqueta="Pedido N°" valor={pedido.numero_pedido_deposito} />
        <CampoDato
          etiqueta="Cliente"
          valor={pedido.clientes ? formatearCliente(pedido.clientes.nombre, pedido.lugar_envio_alias) : '-'}
          destacado
        />
        <CampoDato etiqueta="Lugar de Entrega" valor={pedido.lugar_envio_texto ?? '-'} grande />
      </div>

      {/* 5. Tabla de líneas. El precio es solo de referencia (no hay compra a
          un proveedor detrás de un pedido a depósito): se ve en pantalla
          pero se oculta al imprimir. */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Líneas ({pedido.pedidos_deposito_items.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto print:shadow-none print:border-black">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium text-right print:hidden">Precio</th>
              <th className="px-4 py-2 font-medium text-right">Cantidad</th>
              <th className="px-4 py-2 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {pedido.pedidos_deposito_items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{i.articulos?.codigo_interno ?? '-'}</td>
                <td className="px-4 py-2 text-slate-800">{i.articulos?.nombre ?? '-'}</td>
                <td className="px-4 py-2 text-slate-600">{i.articulos?.categoria ?? '-'}</td>
                <td className="px-4 py-2 text-slate-600 text-right whitespace-nowrap print:hidden">
                  {i.precio_referencia != null ? `$ ${formatearMoneda(i.precio_referencia)}` : '-'}
                </td>
                <td className="px-4 py-2 text-slate-600 text-right whitespace-nowrap">{i.cantidad}</td>
                <td className="px-4 py-2 text-slate-600">{i.observaciones ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 6. Observaciones generales, al pie */}
      {pedido.observaciones_generales && (
        <p className="text-sm text-slate-600 mt-4">Observaciones: {pedido.observaciones_generales}</p>
      )}
    </div>
  )
}
