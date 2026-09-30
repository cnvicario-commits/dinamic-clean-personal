import BotonImprimir from './BotonImprimir'
import { ESTADOS, type PerfilResumen } from '@/types/crm'
import type { CrmSummary } from '@/lib/api/generated'

function formatearMonto(valor: number): string {
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function formatearPorcentaje(parte: number, total: number): string {
  if (total === 0) return '0%'
  return `${((parte / total) * 100).toFixed(0)}%`
}

export default function ResumenEjecutivoVentas({
  resumen,
  responsables,
  query,
}: {
  resumen: CrmSummary
  responsables: PerfilResumen[]
  query: { desde?: string; hasta?: string; responsableId?: string }
}) {
  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <form className="print:hidden flex flex-wrap items-end gap-3 mb-6" action="/ventas/resumen">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Desde (fecha de ingreso)</label>
          <input name="desde" type="date" defaultValue={query.desde} className={selectStyle} />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Hasta</label>
          <input name="hasta" type="date" defaultValue={query.hasta} className={selectStyle} />
        </div>
        <select name="responsableId" defaultValue={query.responsableId ?? ''} className={selectStyle}>
          <option value="">Todos los responsables</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre_completo}</option>
          ))}
        </select>
        <button type="submit" className="rounded bg-teal-600 px-3 py-2 text-sm font-medium text-white">Aplicar</button>
        <div className="flex-1" />
        <BotonImprimir nombreArchivo="Resumen ejecutivo de ventas" />
      </form>

      {/* Totales generales */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Oportunidades</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{resumen.totalCantidad}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Monto estimado total</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">$ {formatearMonto(resumen.totalMonto)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Monto aceptado</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">$ {formatearMonto(resumen.montoAceptado)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Tasa de conversión</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {resumen.tasaConversion === null ? '-' : `${(resumen.tasaConversion * 100).toFixed(0)}%`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">aceptadas / (aceptadas + rechazadas)</p>
        </div>
      </div>

      {/* Por estado */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Por estado</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">% cantidad</th>
              <th className="px-4 py-3 font-medium">Monto estimado</th>
              <th className="px-4 py-3 font-medium">% monto</th>
            </tr>
          </thead>
          <tbody>
            {ESTADOS.map(({ valor, etiqueta }) => {
              const fila = resumen.porEstado.find(item => item.estado === valor) ?? { cantidad: 0, monto: 0 }
              return (
              <tr key={valor} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">{etiqueta}</td>
                <td className="px-4 py-3 text-slate-600">{fila.cantidad}</td>
                <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.cantidad, resumen.totalCantidad)}</td>
                <td className="px-4 py-3 text-slate-600">$ {formatearMonto(fila.monto)}</td>
                <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.monto, resumen.totalMonto)}</td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Por tipo de cliente */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Por tipo de cliente</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Tipo de cliente</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">% cantidad</th>
              <th className="px-4 py-3 font-medium">Monto estimado</th>
              <th className="px-4 py-3 font-medium">% monto</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porTipoCliente.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-slate-400">Sin datos para este período.</td>
              </tr>
            ) : (
              resumen.porTipoCliente.map((fila) => (
                <tr key={fila.nombre} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{fila.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{fila.cantidad}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.cantidad, resumen.totalCantidad)}</td>
                  <td className="px-4 py-3 text-slate-600">$ {formatearMonto(fila.monto)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.monto, resumen.totalMonto)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Por referidor */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Por referidor</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Referidor</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">% cantidad</th>
              <th className="px-4 py-3 font-medium">Monto estimado</th>
              <th className="px-4 py-3 font-medium">% monto</th>
            </tr>
          </thead>
          <tbody>
            {resumen.porReferidor.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-slate-400">Sin datos para este período.</td>
              </tr>
            ) : (
              resumen.porReferidor.map((fila) => (
                <tr key={fila.nombre} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{fila.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{fila.cantidad}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.cantidad, resumen.totalCantidad)}</td>
                  <td className="px-4 py-3 text-slate-600">$ {formatearMonto(fila.monto)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.monto, resumen.totalMonto)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Comisiones (solo oportunidades aceptadas) */}
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Comisiones (oportunidades aceptadas)</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total</p>
          <p className="text-xl font-bold text-slate-800 mt-1">$ {formatearMonto(resumen.comisionTotal)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Liquidada</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">$ {formatearMonto(resumen.comisionLiquidada)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Pendiente</p>
          <p className="text-xl font-bold text-amber-600 mt-1">$ {formatearMonto(resumen.comisionPendiente)}</p>
        </div>
      </div>
    </div>
  )
}
