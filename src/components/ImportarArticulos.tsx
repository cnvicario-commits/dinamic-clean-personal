'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import DescargarPlantillaArticulos from './DescargarPlantillaArticulos'

type FilaArticulo = {
  fila: number
  codigo_interno: string
  nombre: string
  categoria: string | null
  unidad: string | null
}

type FilaError = { fila: number; motivo: string }

type Resumen = {
  creados: number
  actualizados: number
  errores: FilaError[]
}

const COLUMNAS_ESPERADAS = ['codigo_interno', 'nombre']
const TAMANO_LOTE = 15

async function enLotes<T>(items: T[], tamano: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano)
    await Promise.allSettled(lote.map(fn))
  }
}

export default function ImportarArticulos() {
  const [abierto, setAbierto] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResumen(null)

    if (!archivo) {
      setError('Elegí un archivo .xlsx o .csv.')
      return
    }

    setProcesando(true)
    try {
      const esCSV = archivo.name.toLowerCase().endsWith('.csv')
      const libro = esCSV
        ? XLSX.read(await archivo.text(), { type: 'string' })
        : XLSX.read(await archivo.arrayBuffer(), { type: 'array' })

      const hoja = libro.Sheets[libro.SheetNames[0]]
      const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja)

      if (filasCrudas.length === 0) {
        setError('El archivo no tiene filas de datos.')
        setProcesando(false)
        return
      }

      const columnas = Object.keys(filasCrudas[0])
      const faltantes = COLUMNAS_ESPERADAS.filter((c) => !columnas.includes(c))
      if (faltantes.length > 0) {
        setError(`Faltan columnas en el archivo: ${faltantes.join(', ')}. Usá la plantilla descargable.`)
        setProcesando(false)
        return
      }

      const erroresParseo: FilaError[] = []
      const filasValidas: FilaArticulo[] = []

      filasCrudas.forEach((fila, indice) => {
        const numeroFila = indice + 2 // fila 1 = encabezado
        const codigo = String(fila.codigo_interno ?? '').trim()
        const nombre = String(fila.nombre ?? '').trim()
        const categoria = String(fila.categoria ?? '').trim()
        const unidad = String(fila.unidad ?? '').trim()

        if (!codigo) {
          erroresParseo.push({ fila: numeroFila, motivo: 'codigo_interno vacío' })
          return
        }
        if (!nombre) {
          erroresParseo.push({ fila: numeroFila, motivo: 'nombre vacío' })
          return
        }
        filasValidas.push({
          fila: numeroFila,
          codigo_interno: codigo,
          nombre,
          categoria: categoria || null,
          unidad: unidad || null,
        })
      })

      // Duplicados de código dentro del mismo archivo: gana la última fila.
      const porCodigo = new Map<string, FilaArticulo>()
      filasValidas.forEach((f) => porCodigo.set(f.codigo_interno, f))
      const filasUnicas = Array.from(porCodigo.values())

      let creados = 0
      let actualizados = 0
      const erroresEjecucion: FilaError[] = []

      if (filasUnicas.length > 0) {
        // Traemos todo el catálogo una sola vez para resolver el matching en memoria.
        const { data: existentes } = await supabase.from('articulos').select('id, codigo_interno')
        const mapaExistentes = new Map((existentes ?? []).map((a) => [a.codigo_interno, a.id]))

        const aActualizar = filasUnicas.filter((f) => mapaExistentes.has(f.codigo_interno))
        const aCrear = filasUnicas.filter((f) => !mapaExistentes.has(f.codigo_interno))

        await enLotes(aActualizar, TAMANO_LOTE, async (f) => {
          const { error } = await supabase
            .from('articulos')
            .update({ nombre: f.nombre, categoria: f.categoria, unidad: f.unidad })
            .eq('id', mapaExistentes.get(f.codigo_interno))
          if (error) {
            erroresEjecucion.push({ fila: f.fila, motivo: 'Error al actualizar: ' + error.message })
          } else {
            actualizados++
          }
        })

        if (aCrear.length > 0) {
          const { data, error } = await supabase
            .from('articulos')
            .insert(
              aCrear.map((f) => ({
                codigo_interno: f.codigo_interno,
                nombre: f.nombre,
                categoria: f.categoria,
                unidad: f.unidad,
              }))
            )
            .select()
          if (error) {
            erroresEjecucion.push({ fila: 0, motivo: 'Error al insertar artículos nuevos: ' + error.message })
          } else {
            creados = data?.length ?? aCrear.length
          }
        }
      }

      setResumen({
        creados,
        actualizados,
        errores: [...erroresParseo, ...erroresEjecucion],
      })
      setArchivo(null)
      router.refresh()
    } catch (err) {
      setError('Error al procesar el archivo: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="text-sm font-medium text-teal-600 hover:underline"
      >
        {abierto ? 'Ocultar importación masiva' : 'Importar desde Excel'}
      </button>

      {abierto && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600">
              El archivo (.xlsx o .csv) debe tener las columnas{' '}
              <code className="bg-slate-100 px-1 rounded">codigo_interno</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">nombre</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">categoria</code> (opcional) y{' '}
              <code className="bg-slate-100 px-1 rounded">unidad</code> (opcional) en la primera fila.
              Si el código ya existe, se actualiza; si no, se crea el artículo.
            </p>
            <DescargarPlantillaArticulos />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              className="text-sm text-slate-700"
            />
            <button
              type="submit"
              disabled={procesando}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {procesando ? 'Procesando...' : 'Importar artículos'}
            </button>
          </form>

          {error && <p className="text-rose-600 text-sm">{error}</p>}

          {resumen && (
            <div className="border-t border-slate-100 pt-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Resumen de la importación
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Artículos creados</p>
                  <p className="text-xl font-bold text-emerald-600">{resumen.creados}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Artículos actualizados</p>
                  <p className="text-xl font-bold text-slate-700">{resumen.actualizados}</p>
                </div>
              </div>
              {resumen.errores.length > 0 && (
                <details>
                  <summary className="text-sm text-rose-600 cursor-pointer">
                    {resumen.errores.length} fila(s) con errores
                  </summary>
                  <ul className="text-sm text-slate-600 mt-2 space-y-1">
                    {resumen.errores.map((e, i) => (
                      <li key={i}>Fila {e.fila || '-'}: {e.motivo}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
