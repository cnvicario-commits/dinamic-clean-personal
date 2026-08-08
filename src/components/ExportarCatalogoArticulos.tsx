'use client'
import * as XLSX from 'xlsx'

type Articulo = {
  codigo_interno: string
  nombre: string
  categoria: string | null
  unidad: string | null
  activo: boolean
}

export default function ExportarCatalogoArticulos({ articulos }: { articulos: Articulo[] }) {
  const handleExport = () => {
    const filas = articulos
      .filter((a) => a.activo)
      .map((a) => ({
        codigo_interno: a.codigo_interno,
        nombre: a.nombre,
        categoria: a.categoria ?? '',
        unidad: a.unidad ?? '',
      }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Catálogo')
    const fecha = new Date().toISOString().split('T')[0]
    XLSX.writeFile(libro, `catalogo_articulos_${fecha}.xlsx`)
  }

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
    >
      Exportar catálogo
    </button>
  )
}
