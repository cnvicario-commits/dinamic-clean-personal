'use client'

import EstadoBadge from './EstadoBadge'
import BotonImprimir from './BotonImprimir'
import EstadoOrdenCompraBoton from './EstadoOrdenCompraBoton'
import DuplicarOrdenCompraBoton from './DuplicarOrdenCompraBoton'
import type { OrdenCompraDetalleView } from '@/types/compras'

function formatearMoneda(valor: number) {
  return valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Campo de la grilla de datos (etiqueta arriba, valor abajo). 2 por fila en
// vez de 1 por fila: reduce a la mitad el alto total del bloque. `destacado`
// resalta el valor en negrita (usado para "Cliente"); `grande` además lo
// agranda, le pone fondo de color y ocupa las 2 columnas (usado para
// "Lugar de Entrega", que sigue siendo el campo más visible del bloque).
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

export default function OrdenCompraDetalle({
  orden,
  ocultarAcciones,
}: {
  orden: OrdenCompraDetalleView
  // true en la vista de descarga masiva (varias OC juntas): ahí hay un
  // único botón de imprimir arriba de todo, no uno por cada OC, y no tiene
  // sentido poder cambiar estado/duplicar de a una en ese contexto.
  ocultarAcciones?: boolean
}) {
  const subtotal = orden.ordenes_compra_items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)
  const iva = subtotal * 0.21
  const total = subtotal + iva

  // Mismo texto que la fila "Cliente" de la tabla de datos, agregado al
  // nombre del archivo descargado (que ya era el número de OC, ej. OC-0025).
  const clienteEtiqueta = orden.clientes ? formatearCliente(orden.clientes.nombre, orden.lugar_envio_alias) : ''
  const nombreArchivo = clienteEtiqueta ? `${orden.numero_oc} - ${clienteEtiqueta}` : orden.numero_oc

  return (
    <div>
      {!ocultarAcciones && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
          <EstadoBadge estado={orden.estado} />
          <div className="flex gap-2">
            <EstadoOrdenCompraBoton id={orden.id} estado={orden.estado} />
            <DuplicarOrdenCompraBoton id={orden.id} />
            <BotonImprimir nombreArchivo={nombreArchivo} />
          </div>
        </div>
      )}

      {/* 1. Encabezado: nombre de la empresa (sin logo) + N° del pedido de
          compra de origen arriba a la derecha, si vino de uno (el pedido que
          carga el supervisor y que el Panel de compras convierte en esta
          OC). Se ve tanto en pantalla como impreso: es lo que da
          trazabilidad hacia el pedido original una vez hecha la asignación. */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold text-slate-900">{orden.empresas?.nombre}</h1>
        {orden.pedidos_compra && (
          <div className="text-right shrink-0">
            <p className="text-xs text-slate-500">Pedido de origen</p>
            <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">
              N° {orden.pedidos_compra.numero_pedido}
            </p>
          </div>
        )}
      </div>

      {/* 2. N° de OC */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Orden de Compra N° {orden.numero_oc}
        </p>
      </div>

      {/* 3. Banner destacado: lugar de entrega. El más grande del documento,
          por eso el color de fondo se fuerza a imprimir (los navegadores lo
          omiten por defecto salvo que se pida explícitamente). */}
      {orden.lugar_envio_alias && (
        <div
          className="bg-teal-600 text-white text-center py-5 px-4 rounded-lg mb-6 print:rounded-none"
          style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
        >
          <p className="text-3xl font-bold uppercase tracking-wide">{orden.lugar_envio_alias}</p>
        </div>
      )}

      {/* 4. Grilla de datos: 2 columnas en vez de 1 fila por campo, reduce a
          la mitad el alto total del bloque. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-white border border-slate-200 rounded-lg shadow-sm p-3 print:shadow-none print:border-black mb-6">
        <CampoDato etiqueta="Fecha" valor={new Date(`${orden.fecha}T00:00:00`).toLocaleDateString('es-AR')} />
        <CampoDato etiqueta="OC N°" valor={orden.numero_oc} />
        <CampoDato etiqueta="Proveedor" valor={orden.proveedores?.razon_social ?? '-'} />
        <CampoDato etiqueta="Domicilio" valor={orden.proveedores?.domicilio ?? '-'} />
        <CampoDato etiqueta="Provincia" valor={orden.proveedores?.provincia ?? '-'} />
        <CampoDato etiqueta="Condición de Pago" valor={orden.condicion_pago ?? '-'} />
        <CampoDato
          etiqueta="Cliente"
          valor={orden.clientes ? formatearCliente(orden.clientes.nombre, orden.lugar_envio_alias) : '-'}
          destacado
        />
        <CampoDato etiqueta="Horario de Atención" valor={orden.horario_atencion_texto ?? '-'} />
        <CampoDato etiqueta="Lugar de Entrega" valor={orden.lugar_envio_texto ?? '-'} grande />
      </div>

      {/* 5. Tabla de líneas + 6. Totales con IVA */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Líneas ({orden.ordenes_compra_items.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto print:shadow-none print:border-black">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Cód. Proveedor</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium text-right">Precio</th>
              <th className="px-4 py-2 font-medium text-right">Cantidad</th>
              <th className="px-4 py-2 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {orden.ordenes_compra_items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{i.articulos?.codigo_interno ?? '-'}</td>
                <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{i.codigo_proveedor ?? '-'}</td>
                <td className="px-4 py-2 text-slate-800">{i.articulos?.nombre ?? '-'}</td>
                <td className="px-4 py-2 text-slate-600">{i.articulos?.categoria ?? '-'}</td>
                <td className="px-4 py-2 text-slate-600 text-right whitespace-nowrap">$ {formatearMoneda(i.precio_unitario)}</td>
                <td className="px-4 py-2 text-slate-600 text-right whitespace-nowrap">{i.cantidad}</td>
                <td className="px-4 py-2 text-slate-600 text-right whitespace-nowrap">$ {formatearMoneda(i.cantidad * i.precio_unitario)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5}></td>
              <td className="px-4 py-1 text-right text-slate-600">Subtotal</td>
              <td className="px-4 py-1 text-slate-700 text-right whitespace-nowrap">$ {formatearMoneda(subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={5}></td>
              <td className="px-4 py-1 text-right text-slate-600">IVA 21%</td>
              <td className="px-4 py-1 text-slate-700 text-right whitespace-nowrap">$ {formatearMoneda(iva)}</td>
            </tr>
            <tr className="border-t border-slate-200">
              <td colSpan={5}></td>
              <td className="px-4 py-2 text-right font-semibold text-slate-700">Total</td>
              <td className="px-4 py-2 font-semibold text-slate-900 text-right whitespace-nowrap">$ {formatearMoneda(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 7. Observaciones generales, al pie */}
      {orden.observaciones_generales && (
        <p className="text-sm text-slate-600 mt-4">Observaciones: {orden.observaciones_generales}</p>
      )}
    </div>
  )
}
