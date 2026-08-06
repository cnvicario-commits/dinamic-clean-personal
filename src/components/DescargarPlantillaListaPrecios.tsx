'use client'
import * as XLSX from 'xlsx'

export default function DescargarPlantillaListaPrecios() {
  const handleDescargar = () => {
    const filas = [{ codigo_proveedor: '', nombre_proveedor: '', precio: 0 }]
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Plantilla')
    XLSX.writeFile(libro, 'plantilla_lista_precios.xlsx')
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
