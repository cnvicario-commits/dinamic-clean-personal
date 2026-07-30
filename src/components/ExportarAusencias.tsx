'use client'

import * as XLSX from 'xlsx'

type Ausencia = {
  fecha: string
  justificada: boolean
  observaciones: string | null
  empleados: { nombre_apellido: string } | null
}

export default function ExportarAusencias({ ausencias }: { ausencias: Ausencia[] }) {
  const handleExport = () => {
    const filas = ausencias.map((a) => ({
      Empleado: a.empleados?.nombre_apellido || '',
      Fecha: a.fecha,
      Estado: a.justificada ? 'Justificada' : 'Injustificada',
      Observaciones: a.observaciones || '',
    }))

    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Ausencias')

    const fecha = new Date().toISOString().split('T')[0]
    XLSX.writeFile(libro, `ausencias_${fecha}.xlsx`)
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