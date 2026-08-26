'use client'
import { useState, useMemo } from 'react'
import BotonImprimir from './BotonImprimir'
import { ESTADOS, type OportunidadResumen, type PerfilResumen, type CatalogoItem } from '@/types/crm'

function formatearMonto(valor: number): string {
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function formatearPorcentaje(parte: number, total: number): string {
  if (total === 0) return '0%'
  return `${((parte / total) * 100).toFixed(0)}%`
}

export default function ResumenEjecutivoVentas({
  oportunidades,
  responsables,
  tiposCliente,
}: {
  oportunidades: OportunidadResumen[]
  responsables: PerfilResumen[]
  tiposCliente: CatalogoItem[]
}) {
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtroResponsable, setFiltroResponsable] = useState('')

  const filtradas = useMemo(() => {
    let base = oportunidades
    if (fechaDesde) base = base.filter((o) => o.fecha_ingreso >= fechaDesde)
    if (fechaHasta) base = base.filter((o) => o.fecha_ingreso <= fechaHasta)
    if (filtroResponsable) base = base.filter((o) => o.responsable_id === filtroResponsable)
    return base
  }, [oportunidades, fechaDesde, fechaHasta, filtroResponsable])

  const resumen = useMemo(() => {
    const totalCantidad = filtradas.length
    const totalMonto = filtradas.reduce((acc, o) => acc + (o.monto_estimado ?? 0), 0)

    const porEstado = ESTADOS.map(({ valor, etiqueta }) => {
      const del = filtradas.filter((o) => o.estado === valor)
      const monto = del.reduce((acc, o) => acc + (o.monto_estimado ?? 0), 0)
      return { etiqueta, cantidad: del.length, monto }
    })

    const nombresTipoCliente = new Map(tiposCliente.map((t) => [t.id, t.nombre]))
    const gruposTipoCliente = new Map<string, { cantidad: number; monto: number }>()
    for (const o of filtradas) {
      const id = o.crm_prospectos?.tipo_cliente_id
      const nombre = id ? nombresTipoCliente.get(id) ?? 'Otro' : 'Sin tipo de cliente'
      const actual = gruposTipoCliente.get(nombre) ?? { cantidad: 0, monto: 0 }
      actual.cantidad += 1
      actual.monto += o.monto_estimado ?? 0
      gruposTipoCliente.set(nombre, actual)
    }
    const porTipoCliente = Array.from(gruposTipoCliente.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.cantidad - a.cantidad)

    const gruposReferidor = new Map<string, { cantidad: number; monto: number }>()
    for (const o of filtradas) {
      const nombre = o.crm_prospectos?.crm_referidores?.nombre ?? 'Sin referidor'
      const actual = gruposReferidor.get(nombre) ?? { cantidad: 0, monto: 0 }
      actual.cantidad += 1
      actual.monto += o.monto_estimado ?? 0
      gruposReferidor.set(nombre, actual)
    }
    const porReferidor = Array.from(gruposReferidor.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.cantidad - a.cantidad)

    const aceptadas = filtradas.filter((o) => o.estado === 'aceptado')
    const rechazadas = filtradas.filter((o) => o.estado === 'rechazado')
    const denomConversion = aceptadas.length + rechazadas.length
    const tasaConversion = denomConversion > 0 ? aceptadas.length / denomConversion : null

    const comisionTotal = aceptadas.reduce((acc, o) => acc + (o.comision_monto ?? 0), 0)
    const comisionLiquidada = aceptadas.filter((o) => o.comision_liquidada).reduce((acc, o) => acc + (o.comision_monto ?? 0), 0)
    const comisionPendiente = comisionTotal - comisionLiquidada

    return {
      totalCantidad,
      totalMonto,
      porEstado,
      porTipoCliente,
      porReferidor,
      montoAceptado: aceptadas.reduce((acc, o) => acc + (o.monto_estimado ?? 0), 0),
      tasaConversion,
      comisionTotal,
      comisionLiquidada,
      comisionPendiente,
    }
  }, [filtradas, tiposCliente])

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="print:hidden flex flex-wrap items-end gap-3 mb-6">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Desde (fecha de ingreso)</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className={selectStyle} />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className={selectStyle} />
        </div>
        <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className={selectStyle}>
          <option value="">Todos los responsables</option>
          {responsables.map((r) => (
            <option key={r.id} value={r.id}>{r.nombre_completo}</option>
          ))}
        </select>
        <div className="flex-1" />
        <BotonImprimir nombreArchivo="Resumen ejecutivo de ventas" />
      </div>

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
            {resumen.porEstado.map((fila) => (
              <tr key={fila.etiqueta} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">{fila.etiqueta}</td>
                <td className="px-4 py-3 text-slate-600">{fila.cantidad}</td>
                <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.cantidad, resumen.totalCantidad)}</td>
                <td className="px-4 py-3 text-slate-600">$ {formatearMonto(fila.monto)}</td>
                <td className="px-4 py-3 text-slate-600">{formatearPorcentaje(fila.monto, resumen.totalMonto)}</td>
              </tr>
            ))}
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
