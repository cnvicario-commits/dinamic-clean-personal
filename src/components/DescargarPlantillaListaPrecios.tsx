'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'

const FILA_EJEMPLO = { codigo_proveedor: '', nombre_proveedor: '', precio: 0, codigo_interno: '' }

export default function DescargarPlantillaListaPrecios({ proveedorId }: { proveedorId: string }) {
  const [descargando, setDescargando] = useState(false)
  const supabase = createClient()

  const handleDescargar = async () => {
    setDescargando(true)
    try {
      // Si ya hay un proveedor elegido y tiene vínculos cargados, la
      // plantilla sale precompletada con lo que ya tiene (código propio,
      // nombre, precio actual y código interno) para que el usuario solo
      // tenga que corregir precios en vez de tipear todo desde cero. Si es
      // la primera vez que se le carga una lista a ese proveedor (o no se
      // eligió ninguno todavía), se usa la fila de ejemplo de siempre.
      let filas: (typeof FILA_EJEMPLO)[] = [FILA_EJEMPLO]
      if (proveedorId) {
        const { data } = await supabase
          .from('articulos_proveedor')
          .select('codigo_proveedor, nombre_proveedor, precio, articulos(codigo_interno)')
          .eq('proveedor_id', proveedorId)
          .order('codigo_proveedor')
        const vinculos = (data ?? []) as unknown as {
          codigo_proveedor: string
          nombre_proveedor: string | null
          precio: number
          articulos: { codigo_interno: string } | null
        }[]
        if (vinculos.length > 0) {
          filas = vinculos.map((v) => ({
            codigo_proveedor: v.codigo_proveedor,
            nombre_proveedor: v.nombre_proveedor ?? '',
            precio: v.precio,
            codigo_interno: v.articulos?.codigo_interno ?? '',
          }))
        }
      }

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
        filas.length > 1
          ? ['Esta plantilla ya viene con lo que este proveedor tiene cargado hoy: solo hace falta corregir los precios que cambiaron (o agregar filas nuevas al final).']
          : ['Este proveedor todavía no tiene artículos vinculados, así que la plantilla sale en blanco.'],
      ])
      XLSX.utils.book_append_sheet(libro, instrucciones, 'Instrucciones')

      XLSX.writeFile(libro, 'plantilla_lista_precios.xlsx')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDescargar}
      disabled={descargando}
      className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
    >
      {descargando ? 'Generando...' : 'Descargar plantilla'}
    </button>
  )
}
