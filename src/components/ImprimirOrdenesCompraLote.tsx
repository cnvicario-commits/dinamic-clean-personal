'use client'

import BotonImprimir from './BotonImprimir'
import OrdenCompraDetalle from './OrdenCompraDetalle'
import type { OrdenCompraDetalleView } from '@/types/compras'

export default function ImprimirOrdenesCompraLote({
  ordenes,
  nombreArchivo,
}: {
  ordenes: OrdenCompraDetalleView[]
  nombreArchivo: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <p className="text-sm text-slate-600">{ordenes.length} orden(es) de compra seleccionada(s)</p>
        <BotonImprimir nombreArchivo={nombreArchivo} />
      </div>

      {ordenes.map((orden, indice) => (
        <div
          key={orden.id}
          className={
            indice > 0
              ? 'print:break-before-page mt-10 pt-10 border-t border-slate-200 print:mt-0 print:pt-0 print:border-t-0'
              : ''
          }
        >
          <OrdenCompraDetalle orden={orden} ocultarAcciones />
        </div>
      ))}
    </div>
  )
}
