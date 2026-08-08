'use client'

import EstadoBadge from './EstadoBadge'
import BotonImprimir from './BotonImprimir'
import type { PedidoCompraDetalleView } from '@/types/compras'

export default function PedidoCompraDetalle({ pedido }: { pedido: PedidoCompraDetalleView }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <EstadoBadge estado={pedido.estado} />
        <BotonImprimir />
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">{pedido.empresas?.nombre}</h1>
        <p className="text-sm">{pedido.empresas?.cuit} · {pedido.empresas?.domicilio}</p>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Cliente: <span className="font-medium text-slate-700">{pedido.clientes?.nombre}</span>
        {' · '}Fecha: {new Date(pedido.created_at).toLocaleDateString('es-AR')}
      </p>

      {pedido.observaciones_generales && (
        <p className="text-sm text-slate-600 mb-6">Observaciones: {pedido.observaciones_generales}</p>
      )}

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Líneas ({pedido.pedidos_compra_items.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto print:shadow-none print:border-black">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Artículo</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {pedido.pedidos_compra_items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  {i.articulos ? `${i.articulos.codigo_interno} — ${i.articulos.nombre}` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{i.cantidad}</td>
                <td className="px-4 py-3 text-slate-600">{i.observaciones ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
