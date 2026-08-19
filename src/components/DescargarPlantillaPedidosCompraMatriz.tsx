'use client'
import * as XLSX from 'xlsx'
import type { ArticuloResumen } from '@/types/compras'

export default function DescargarPlantillaPedidosCompraMatriz({ articulos }: { articulos: ArticuloResumen[] }) {
  const handleDescargar = () => {
    // Columnas A/B ya completadas con el catálogo activo (para que el
    // supervisor no tenga que tipearlas), C/D con encabezados de ejemplo
    // para que sepa dónde poner los alias reales. No se usa json_to_sheet
    // porque las columnas de alias son dinámicas, no un set fijo de campos.
    const filas: (string | number)[][] = [
      ['codigo_interno', 'nombre', 'Ej: Alias Domicilio 1', 'Ej: Alias Domicilio 2'],
      ...articulos.map((a) => [a.codigo_interno, a.nombre]),
    ]
    const hoja = XLSX.utils.aoa_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Plantilla')

    const instrucciones = XLSX.utils.aoa_to_sheet([
      ['Columna A (codigo_interno) y columna B (nombre) ya vienen completadas con el catálogo de artículos activos.'],
      ['La columna B es solo de referencia visual, no se usa para procesar el archivo.'],
      ['A partir de la columna C, cada columna es un domicilio de entrega: el encabezado tiene que ser exactamente el alias del domicilio tal como figura en Clientes (ej: Depósito Central).'],
      ['Debajo de cada columna de alias, completá la cantidad pedida de cada artículo para ese cliente/domicilio. Dejá vacío si no se pide.'],
      ['Se genera un pedido de compra en borrador por cada columna que tenga al menos una cantidad cargada. Las columnas sin ninguna cantidad no generan pedido.'],
      ['Si un alias no se encuentra, esa columna entera queda afuera y se avisa en el resumen, sin afectar al resto del archivo.'],
    ])
    XLSX.utils.book_append_sheet(libro, instrucciones, 'Instrucciones')

    XLSX.writeFile(libro, 'plantilla_pedidos_compra_matriz.xlsx')
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
