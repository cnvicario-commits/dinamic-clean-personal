'use client'

import EstadoBadge from './EstadoBadge'
import BotonImprimir from './BotonImprimir'
import EstadoOrdenCompraBoton from './EstadoOrdenCompraBoton'
import DuplicarOrdenCompraBoton from './DuplicarOrdenCompraBoton'
import type { OrdenCompraDetalleView } from '@/types/compras'

function formatearMoneda(valor: number) {
  return valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Fila de la tabla de datos (etiqueta / valor). `destacado` resalta el valor
// en negrita (usado para "Cliente"); `grande` además lo agranda y le pone
// fondo de color (usado para "Lugar de Entrega").
function FilaDato({
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
    <tr className={`border-b border-slate-100 last:border-0 ${grande ? 'bg-teal-50' : ''}`}>
      <td className={`px-4 py-2 text-slate-500 w-48 align-top ${grande ? 'py-3' : ''}`}>{etiqueta}</td>
      <td
        className={`px-4 py-2 text-slate-800 ${destacado || grande ? 'font-semibold' : ''} ${
          grande ? 'py-3 text-lg text-teal-800' : ''
        }`}
      >
        {valor}
      </td>
    </tr>
  )
}

function formatearCliente(nombre: string, alias: string | null) {
  return alias ? `${nombre}-${alias}` : nombre
}

export default function OrdenCompraDetalle({ orden }: { orden: OrdenCompraDetalleView }) {
  const subtotal = orden.ordenes_compra_items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)
  const iva = subtotal * 0.21
  const total = subtotal + iva

  // Mismo texto que la fila "Cliente" de la tabla de datos, agregado al
  // nombre del archivo descargado (que ya era el número de OC, ej. OC-0025).
  const clienteEtiqueta = orden.clientes ? formatearCliente(orden.clientes.nombre, orden.lugar_envio_alias) : ''
  const nombreArchivo = clienteEtiqueta ? `${orden.numero_oc} - ${clienteEtiqueta}` : orden.numero_oc

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <EstadoBadge estado={orden.estado} />
        <div className="flex gap-2">
          <EstadoOrdenCompraBoton id={orden.id} estado={orden.estado} />
          <DuplicarOrdenCompraBoton id={orden.id} />
          <BotonImprimir nombreArchivo={nombreArchivo} />
        </div>
      </div>

      {/* 1. Encabezado: nombre de la empresa, sin logo. */}
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{orden.empresas?.nombre}</h1>

      {/* 2. N° de OC */}
      <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">
        Orden de Compra N° {orden.numero_oc}
      </p>

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

      {/* 4. Tabla de datos */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto print:shadow-none print:border-black mb-6">
        <table className="w-full text-sm">
          <tbody>
            <FilaDato etiqueta="Fecha" valor={new Date(`${orden.fecha}T00:00:00`).toLocaleDateString('es-AR')} />
            <FilaDato etiqueta="OC N°" valor={orden.numero_oc} />
            <FilaDato etiqueta="Proveedor" valor={orden.proveedores?.razon_social ?? '-'} />
            <FilaDato etiqueta="Domicilio" valor={orden.proveedores?.domicilio ?? '-'} />
            <FilaDato etiqueta="Provincia" valor={orden.proveedores?.provincia ?? '-'} />
            <FilaDato etiqueta="Condición de Pago" valor={orden.condicion_pago ?? '-'} />
            <FilaDato
              etiqueta="Cliente"
              valor={orden.clientes ? formatearCliente(orden.clientes.nombre, orden.lugar_envio_alias) : '-'}
              destacado
            />
            <FilaDato etiqueta="Lugar de Entrega" valor={orden.lugar_envio_texto ?? '-'} grande />
            <FilaDato etiqueta="Horario de Atención" valor={orden.horario_atencion_texto ?? '-'} />
          </tbody>
        </table>
      </div>

      {/* 5. Tabla de líneas + 6. Totales con IVA */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Líneas ({orden.ordenes_compra_items.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto print:shadow-none print:border-black">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {orden.ordenes_compra_items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-600">{i.articulos?.codigo_interno ?? '-'}</td>
                <td className="px-4 py-3 text-slate-800">{i.articulos?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">$ {formatearMoneda(i.precio_unitario)}</td>
                <td className="px-4 py-3 text-slate-600">{i.cantidad}</td>
                <td className="px-4 py-3 text-slate-600">$ {formatearMoneda(i.cantidad * i.precio_unitario)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-600">Subtotal</td>
              <td className="px-4 py-2 text-slate-700">$ {formatearMoneda(subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-600">IVA 21%</td>
              <td className="px-4 py-2 text-slate-700">$ {formatearMoneda(iva)}</td>
            </tr>
            <tr className="border-t border-slate-200">
              <td colSpan={4} className="px-4 py-3 text-right font-semibold text-slate-700">Total</td>
              <td className="px-4 py-3 font-semibold text-slate-900">$ {formatearMoneda(total)}</td>
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
