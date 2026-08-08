'use client'
import * as XLSX from 'xlsx'

export default function DescargarPlantillaListaPrecios() {
  const handleDescargar = () => {
    const filas = [{ codigo_proveedor: '', nombre_proveedor: '', precio: 0, codigo_interno: '' }]
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Plantilla')

    // codigo_interno es opcional: se aclara en una hoja aparte en vez de un
    // comentario de celda, que la librería de generación de Excel no soporta
    // de forma confiable.
    const instrucciones = XLSX.utils.aoa_to_sheet([
      ['codigo_interno es OPCIONAL.'],
      ['Si lo completás, tiene que ser exactamente el código interno del artículo tal como figura en la pantalla de Artículos (ej: ART-0001).'],
      ['Si el código no existe, la fila queda en Pendientes por resolver, avisando el código que no se encontró.'],
      ['Si lo dejás vacío, el sistema intenta matchear por codigo_proveedor como hasta ahora; si no encuentra nada, la fila también queda en Pendientes.'],
    ])
    XLSX.utils.book_append_sheet(libro, instrucciones, 'Instrucciones')

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
