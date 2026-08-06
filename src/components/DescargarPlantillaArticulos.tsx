'use client'
import * as XLSX from 'xlsx'

export default function DescargarPlantillaArticulos() {
  const handleDescargar = () => {
    const filas = [
      { codigo_interno: 'ART-0001', nombre: 'Detergente multiuso', categoria: 'Limpieza', unidad: 'litro' },
    ]
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Plantilla')
    XLSX.writeFile(libro, 'plantilla_articulos.xlsx')
  }
  return (
    <button
      onClick={handleDescargar}
      className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
    >
      Descargar plantilla
    </button>
  )
}
