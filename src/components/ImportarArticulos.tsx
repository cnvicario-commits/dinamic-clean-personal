'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import DescargarPlantillaArticulos from './DescargarPlantillaArticulos'
import { calcularMaximoCodigo, formatearCodigoArticulo } from '@/utils/codigoArticulo'

type FilaArticulo = {
  fila: number
  codigo_interno: string // puede venir vacío: se autogenera al procesar
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

const COLUMNAS_ESPERADAS = ['nombre'] // codigo_interno es opcional: se autogenera si falta
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

      // Duplicados de código EXPLÍCITO dentro del mismo archivo: gana la última
      // fila. Las filas sin código (se autogenera) no participan de este dedup,
      // cada una necesita su propio código nuevo.
      const conCodigo = filasValidas.filter((f) => f.codigo_interno !== '')
      const sinCodigo = filasValidas.filter((f) => f.codigo_interno === '')
      const porCodigo = new Map<string, FilaArticulo>()
      conCodigo.forEach((f) => porCodigo.set(f.codigo_interno, f))
      const conCodigoUnicas = Array.from(porCodigo.values())

      let creados = 0
      let actualizados = 0
      const erroresEjecucion: FilaError[] = []

      // Traemos todo el catálogo una sola vez: resuelve el matching por código
      // explícito y sirve de base para calcular el siguiente código autogenerado.
      const { data: existentes } = await supabase.from('articulos').select('id, codigo_interno')
      const listaExistentes = existentes ?? []
      const mapaExistentes = new Map(listaExistentes.map((a) => [a.codigo_interno, a.id]))

      const aActualizar = conCodigoUnicas.filter((f) => mapaExistentes.has(f.codigo_interno))
      const aCrearConCodigo = conCodigoUnicas.filter((f) => !mapaExistentes.has(f.codigo_interno))

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

      // Altas con código explícito (no coincide con ninguno existente).
      await enLotes(aCrearConCodigo, TAMANO_LOTE, async (f) => {
        const { error } = await supabase.from('articulos').insert({
          codigo_interno: f.codigo_interno,
          nombre: f.nombre,
          categoria: f.categoria,
          unidad: f.unidad,
        })
        if (error) {
          erroresEjecucion.push({ fila: f.fila, motivo: 'Error al crear: ' + error.message })
        } else {
          creados++
        }
      })

      // Altas sin código: se autogenera correlativo (ART-0001, ART-0002, ...) a
      // partir del máximo existente, incrementando localmente fila por fila
      // para no repetir dentro del mismo archivo. Ante una colisión rarísima
      // (otra carga corriendo en simultáneo) se reintenta con el siguiente número.
      let siguienteCodigo = calcularMaximoCodigo(listaExistentes) + 1
      await enLotes(sinCodigo, TAMANO_LOTE, async (f) => {
        for (let intento = 0; intento < 5; intento++) {
          const codigoAsignado = formatearCodigoArticulo(siguienteCodigo)
          siguienteCodigo++
          const { error } = await supabase.from('articulos').insert({
            codigo_interno: codigoAsignado,
            nombre: f.nombre,
            categoria: f.categoria,
            unidad: f.unidad,
          })
          if (!error) {
            creados++
            return
          }
          if (error.code !== '23505') {
            erroresEjecucion.push({ fila: f.fila, motivo: 'Error al crear: ' + error.message })
            return
          }
        }
        erroresEjecucion.push({ fila: f.fila, motivo: 'No se pudo generar un código interno único.' })
      })

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
              El archivo (.xlsx o .csv) debe tener la columna{' '}
              <code className="bg-slate-100 px-1 rounded">nombre</code> (obligatoria) y opcionalmente{' '}
              <code className="bg-slate-100 px-1 rounded">codigo_interno</code>,{' '}
              <code className="bg-slate-100 px-1 rounded">categoria</code> y{' '}
              <code className="bg-slate-100 px-1 rounded">unidad</code> en la primera fila.
              Si dejás <code className="bg-slate-100 px-1 rounded">codigo_interno</code> vacío, se genera
              automáticamente (ART-0001, ART-0002, ...). Si lo completás y ya existe, se actualiza ese artículo.
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
