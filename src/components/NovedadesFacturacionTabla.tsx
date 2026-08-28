'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { nombreResponsable, type OportunidadListado } from '@/types/crm'

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

function formatearMonto(valor: number | null): string {
  if (valor === null) return '-'
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function mesActual(): string {
  const hoy = new Date()
  const mm = String(hoy.getMonth() + 1).padStart(2, '0')
  return `${hoy.getFullYear()}-${mm}`
}

// Solo informativa: avisa de altas nuevas para facturar (a partir de esta
// fecha hay que empezar a facturarle a este cliente), no lleva control de
// la facturación recurrente de clientes ya activos — eso queda fuera de
// este sistema. Por eso no hay ningún botón de "marcar como facturado".
export default function NovedadesFacturacionTabla({
  oportunidades,
}: {
  oportunidades: OportunidadListado[]
}) {
  const [mes, setMes] = useState(mesActual())

  const filtradas = useMemo(() => {
    if (!mes) return oportunidades
    return oportunidades
      .filter((o) => (o.fecha_facturacion ?? '').slice(0, 7) === mes)
      .sort((a, b) => (a.fecha_facturacion ?? '').localeCompare(b.fecha_facturacion ?? ''))
  }, [oportunidades, mes])

  const totalMonto = filtradas.reduce((acc, o) => acc + (o.monto_estimado ?? 0), 0)

  function exportar() {
    const filas = filtradas.map((o) => ({
      cliente: o.crm_prospectos?.nombre ?? '',
      tipo_servicio: o.crm_tipos_servicio?.nombre ?? '',
      monto_estimado: o.monto_estimado ?? '',
      fecha_facturacion: o.fecha_facturacion ?? '',
      responsable: nombreResponsable(o),
      comentarios: o.comentarios ?? '',
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Novedades facturación')
    XLSX.writeFile(libro, `novedades_facturacion_${mes || 'todas'}.xlsx`)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          {mes && (
            <button
              type="button"
              onClick={() => setMes('')}
              className="text-sm text-slate-500 hover:underline"
            >
              Ver todas
            </button>
          )}
        </div>
        <button
          onClick={exportar}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Exportar a Excel
        </button>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Novedades ({filtradas.length}) — total estimado $ {formatearMonto(totalMonto)}
      </h2>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo servicio</th>
              <th className="px-4 py-3 font-medium">Monto estimado</th>
              <th className="px-4 py-3 font-medium">Fecha facturación</th>
              <th className="px-4 py-3 font-medium">Responsable</th>
              <th className="px-4 py-3 font-medium">Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  <Link href={`/ventas/${o.id}`} className="text-teal-600 hover:underline">
                    {o.crm_prospectos?.nombre ?? '-'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{o.crm_tipos_servicio?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">$ {formatearMonto(o.monto_estimado)}</td>
                <td className="px-4 py-3 text-slate-600">{formatearFecha(o.fecha_facturacion)}</td>
                <td className="px-4 py-3 text-slate-600">{nombreResponsable(o)}</td>
                <td className="px-4 py-3 text-slate-600 max-w-[260px] truncate" title={o.comentarios ?? ''}>
                  {o.comentarios ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtradas.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay novedades de facturación para este mes.</p>
      )}
    </div>
  )
}
