'use client'
import * as XLSX from 'xlsx'
import { type RelOne, relOne } from '@/lib/supabase-rel'
type Asistencia = {
  fecha: string
  codigo: string
  horas_extras: number | null
  observaciones: string | null
  empleados: RelOne<{ nombre_apellido: string }>
}
export default function ExportarAusencias({ asistencias }: { asistencias: Asistencia[] }) {
  const handleExport = () => {
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
  }
  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
    >
      Exportar a Excel
    </button>
  )
}