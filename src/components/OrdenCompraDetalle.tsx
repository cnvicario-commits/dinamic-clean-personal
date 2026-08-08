'use client'

import EstadoBadge from './EstadoBadge'
import BotonImprimir from './BotonImprimir'
import EstadoOrdenCompraBoton from './EstadoOrdenCompraBoton'
import DuplicarOrdenCompraBoton from './DuplicarOrdenCompraBoton'
import type { OrdenCompraDetalleView } from '@/types/compras'

function formatearMoneda(valor: number) {
  return valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function OrdenCompraDetalle({ orden }: { orden: OrdenCompraDetalleView }) {
  const total = orden.ordenes_compra_items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <EstadoBadge estado={orden.estado} />
        </div>
        <div className="flex gap-2">
          <EstadoOrdenCompraBoton id={orden.id} estado={orden.estado} />
          <DuplicarOrdenCompraBoton id={orden.id} />
          <BotonImprimir nombreArchivo={orden.numero_oc} />
        </div>
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">{orden.empresas?.nombre}</h1>
        <p className="text-sm">{orden.empresas?.cuit} · {orden.empresas?.domicilio}</p>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        N° de OC: <span className="font-medium text-slate-700">{orden.numero_oc}</span>
        {' · '}Proveedor: <span className="font-medium text-slate-700">{orden.proveedores?.razon_social}</span>
        {' · '}Cliente: <span className="font-medium text-slate-700">{orden.clientes?.nombre}</span>
        {' · '}Fecha: {new Date(`${orden.fecha}T00:00:00`).toLocaleDateString('es-AR')}
      </p>

      {orden.observaciones_generales && (
        <p className="text-sm text-slate-600 mb-6">Observaciones: {orden.observaciones_generales}</p>
      )}

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Líneas ({orden.ordenes_compra_items.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto print:shadow-none print:border-black">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Artículo</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Precio unitario</th>
              <th className="px-4 py-3 font-medium">Subtotal</th>
              <th className="px-4 py-3 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {orden.ordenes_compra_items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  {i.articulos ? `${i.articulos.codigo_interno} — ${i.articulos.nombre}` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{i.cantidad}</td>
                <td className="px-4 py-3 text-slate-600">$ {formatearMoneda(i.precio_unitario)}</td>
                <td className="px-4 py-3 text-slate-600">$ {formatearMoneda(i.cantidad * i.precio_unitario)}</td>
                <td className="px-4 py-3 text-slate-600">{i.observaciones ?? '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-slate-700">Total</td>
              <td className="px-4 py-3 font-semibold text-slate-900">$ {formatearMoneda(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
