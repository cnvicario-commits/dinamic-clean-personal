'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import { fetchAllPages } from '@/lib/api/fetch-all-pages'
import type { AttendanceItem } from '@/lib/api/generated/types'
import { type RelOne, relOne } from '@/lib/supabase-rel'

type Asistencia = {
  fecha: string
  codigo: string
  horas_extras: number | null
  observaciones: string | null
  empleados: RelOne<{ nombre_apellido: string }>
}

function toExportRows(items: AttendanceItem[]): Asistencia[] {
  return items.map((a) => ({
    fecha: a.fecha,
    codigo: a.codigo,
    horas_extras: a.horasExtras,
    observaciones: a.observaciones,
    empleados: a.empleadoNombre ? { nombre_apellido: a.empleadoNombre } : null,
  }))
}

export default function ExportarAusencias() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExport = async () => {
    setError('')
    setLoading(true)
    try {
      const api = await createAuthenticatedBrowserApiClient()
      const items = await fetchAllPages((query) => api.listAttendance(query))
      const asistencias = toExportRows(items)
      const filas = asistencias.map((a) => ({
        Empleado: relOne(a.empleados)?.nombre_apellido || '',
        Fecha: a.fecha,
        Código: a.codigo,
        'Horas extra': a.horas_extras || 0,
        Observaciones: a.observaciones || '',
      }))
      const hoja = XLSX.utils.json_to_sheet(filas)
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, 'Novedades')
      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(libro, `novedades_${fecha}.xlsx`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Preparando exportación…' : 'Exportar a Excel'}
      </button>
      {error ? <p className="text-rose-600 text-xs">{error}</p> : null}
    </div>
  )
}
