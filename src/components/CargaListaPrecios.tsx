'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import DescargarPlantillaListaPrecios from './DescargarPlantillaListaPrecios'

type Proveedor = { id: string; razon_social: string }

type FilaExcel = {
  fila: number
  codigo: string
  nombre: string
  precio: number
  codigoInterno: string // '' si no vino en el Excel (la columna es opcional)
}

type FilaError = { fila: number; motivo: string }

type Resumen = {
  actualizados: number
  vinculadosPorCodigoInterno: number
  pendientesNuevas: number
  pendientesActualizadas: number
  errores: FilaError[]
}

const COLUMNAS_ESPERADAS = ['codigo_proveedor', 'nombre_proveedor', 'precio']
const TAMANO_LOTE = 15

function normalizarPrecio(valor: unknown): number {
  if (typeof valor === 'number') return valor
  const texto = String(valor ?? '').trim().replace(',', '.')
  return Number(texto)
}

async function enLotes<T>(items: T[], tamano: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano)
    await Promise.allSettled(lote.map(fn))
  }
}

export default function CargaListaPrecios({ proveedores }: { proveedores: Proveedor[] }) {
  const [proveedorId, setProveedorId] = useState('')
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

    if (!proveedorId) {
      setError('Elegí un proveedor.')
      return
    }
    if (!archivo) {
      setError('Elegí un archivo Excel (.xlsx).')
      return
    }

    setProcesando(true)
    try {
      const buffer = await archivo.arrayBuffer()
      const libro = XLSX.read(buffer, { type: 'array' })
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
        setError(`Faltan columnas en el Excel: ${faltantes.join(', ')}. Usá la plantilla descargable.`)
        setProcesando(false)
        return
      }

      const erroresParseo: FilaError[] = []
      const filasValidas: FilaExcel[] = []

      filasCrudas.forEach((fila, indice) => {
        const numeroFila = indice + 2 // fila 1 = encabezado
        const codigo = String(fila.codigo_proveedor ?? '').trim()
        const nombre = String(fila.nombre_proveedor ?? '').trim()
        const precio = normalizarPrecio(fila.precio)
        const codigoInterno = String(fila.codigo_interno ?? '').trim()

        if (!codigo) {
          erroresParseo.push({ fila: numeroFila, motivo: 'codigo_proveedor vacío' })
          return
        }
        if (isNaN(precio)) {
          erroresParseo.push({ fila: numeroFila, motivo: 'precio inválido' })
          return
        }
        filasValidas.push({ fila: numeroFila, codigo, nombre, precio, codigoInterno })
      })

      // Duplicados de código dentro del mismo archivo: gana la última fila.
      const porCodigo = new Map<string, FilaExcel>()
      filasValidas.forEach((f) => porCodigo.set(f.codigo, f))
      const filasUnicas = Array.from(porCodigo.values())

      // Vínculos ya existentes de este proveedor.
      const { data: existentes } = await supabase
        .from('articulos_proveedor')
        .select('id, codigo_proveedor')
        .eq('proveedor_id', proveedorId)
      const mapaExistentes = new Map((existentes ?? []).map((v) => [v.codigo_proveedor, v.id]))

      // Pendientes no resueltas de este proveedor (para no duplicarlas si se reimporta).
      const { data: pendientesActuales } = await supabase
        .from('articulos_proveedor_pendientes')
        .select('id, codigo_proveedor')
        .eq('proveedor_id', proveedorId)
        .eq('resuelto', false)
      const mapaPendientes = new Map((pendientesActuales ?? []).map((p) => [p.codigo_proveedor, p.id]))

      // Catálogo interno completo, para poder vincular directo cuando el
      // Excel trae codigo_interno (columna opcional).
      const { data: articulosTodos } = await supabase.from('articulos').select('id, codigo_interno')
      const mapaArticulosPorCodigo = new Map((articulosTodos ?? []).map((a) => [a.codigo_interno, a.id]))

      const conCodigoInterno = filasUnicas.filter((f) => f.codigoInterno !== '')
      const sinCodigoInterno = filasUnicas.filter((f) => f.codigoInterno === '')

      // codigo_interno válido -> se vincula directo, sin pasar por pendientes.
      const aVincularPorCodigoInterno = conCodigoInterno.filter((f) => mapaArticulosPorCodigo.has(f.codigoInterno))
      // codigo_interno inválido -> siempre a pendientes (aunque el codigo_proveedor
      // ya tuviera un vínculo), para que se note el error de tipeo en vez de
      // pasar desapercibido.
      const conCodigoInternoInvalido = conCodigoInterno.filter((f) => !mapaArticulosPorCodigo.has(f.codigoInterno))

      const aActualizar = sinCodigoInterno.filter((f) => mapaExistentes.has(f.codigo))
      const candidatosPendiente = [
        ...sinCodigoInterno.filter((f) => !mapaExistentes.has(f.codigo)),
        ...conCodigoInternoInvalido,
      ]
      const aPendienteNueva = candidatosPendiente.filter((f) => !mapaPendientes.has(f.codigo))
      const aPendienteActualizar = candidatosPendiente.filter((f) => mapaPendientes.has(f.codigo))

      function motivoDe(f: FilaExcel): string | null {
        return f.codigoInterno ? `código interno indicado no encontrado: ${f.codigoInterno}` : null
      }

      let actualizados = 0
      let vinculadosPorCodigoInterno = 0
      let pendientesActualizadas = 0
      const erroresEjecucion: FilaError[] = []

      await enLotes(aActualizar, TAMANO_LOTE, async (f) => {
        const { error } = await supabase
          .from('articulos_proveedor')
          .update({
            precio: f.precio,
            nombre_proveedor: f.nombre || null,
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq('id', mapaExistentes.get(f.codigo))
        if (error) {
          erroresEjecucion.push({ fila: f.fila, motivo: 'Error al actualizar precio: ' + error.message })
        } else {
          actualizados++
        }
      })

      // Vinculación directa por código interno: actualiza el vínculo si ya
      // existía para este proveedor+código, o lo crea si es la primera vez.
      const aVincularExistente = aVincularPorCodigoInterno.filter((f) => mapaExistentes.has(f.codigo))
      const aVincularNuevo = aVincularPorCodigoInterno.filter((f) => !mapaExistentes.has(f.codigo))

      await enLotes(aVincularExistente, TAMANO_LOTE, async (f) => {
        const { error } = await supabase
          .from('articulos_proveedor')
          .update({
            articulo_id: mapaArticulosPorCodigo.get(f.codigoInterno),
            precio: f.precio,
            nombre_proveedor: f.nombre || null,
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq('id', mapaExistentes.get(f.codigo))
        if (error) {
          erroresEjecucion.push({ fila: f.fila, motivo: 'Error al vincular por código interno: ' + error.message })
        } else {
          vinculadosPorCodigoInterno++
        }
      })

      if (aVincularNuevo.length > 0) {
        const { data, error } = await supabase
          .from('articulos_proveedor')
          .insert(
            aVincularNuevo.map((f) => ({
              articulo_id: mapaArticulosPorCodigo.get(f.codigoInterno),
              proveedor_id: proveedorId,
              codigo_proveedor: f.codigo,
              nombre_proveedor: f.nombre || null,
              precio: f.precio,
              fecha_actualizacion: new Date().toISOString(),
            }))
          )
          .select()
        if (error) {
          erroresEjecucion.push({ fila: 0, motivo: 'Error al vincular por código interno: ' + error.message })
        } else {
          vinculadosPorCodigoInterno += data?.length ?? aVincularNuevo.length
        }
      }

      // Si alguna de estas filas ya tenía una pendiente sin resolver (de una
      // carga anterior), queda resuelta: ya se vinculó directo esta vez.
      const aLimpiarPendiente = aVincularPorCodigoInterno.filter((f) => mapaPendientes.has(f.codigo))
      await enLotes(aLimpiarPendiente, TAMANO_LOTE, async (f) => {
        await supabase
          .from('articulos_proveedor_pendientes')
          .update({ resuelto: true })
          .eq('id', mapaPendientes.get(f.codigo))
      })

      await enLotes(aPendienteActualizar, TAMANO_LOTE, async (f) => {
        const { error } = await supabase
          .from('articulos_proveedor_pendientes')
          .update({
            precio: f.precio,
            nombre_proveedor: f.nombre || null,
            archivo_origen: archivo.name,
            motivo: motivoDe(f),
          })
          .eq('id', mapaPendientes.get(f.codigo))
        if (error) {
          erroresEjecucion.push({ fila: f.fila, motivo: 'Error al actualizar pendiente: ' + error.message })
        } else {
          pendientesActualizadas++
        }
      })

      let pendientesNuevas = 0
      if (aPendienteNueva.length > 0) {
        const { data, error } = await supabase
          .from('articulos_proveedor_pendientes')
          .insert(
            aPendienteNueva.map((f) => ({
              proveedor_id: proveedorId,
              codigo_proveedor: f.codigo,
              nombre_proveedor: f.nombre || null,
              precio: f.precio,
              archivo_origen: archivo.name,
              motivo: motivoDe(f),
            }))
          )
          .select()
        if (error) {
          erroresEjecucion.push({ fila: 0, motivo: 'Error al insertar pendientes nuevas: ' + error.message })
        } else {
          pendientesNuevas = data?.length ?? aPendienteNueva.length
        }
      }

      setResumen({
        actualizados,
        vinculadosPorCodigoInterno,
        pendientesNuevas,
        pendientesActualizadas,
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

  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">
          El Excel debe tener las columnas <code className="bg-slate-100 px-1 rounded">codigo_proveedor</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">nombre_proveedor</code> y{' '}
          <code className="bg-slate-100 px-1 rounded">precio</code> en la primera fila (en cualquier orden).
          Opcionalmente podés agregar <code className="bg-slate-100 px-1 rounded">codigo_interno</code>: si lo
          completás con un código que exista en Artículos, el precio se vincula directo a ese artículo sin pasar por
          Pendientes. Si lo completás pero no existe, la fila va a Pendientes avisando el código que no se encontró.
        </p>
        <DescargarPlantillaListaPrecios />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
        <select
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
          required
          className={`w-64 ${inputStyle}`}
        >
          <option value="">Elegí un proveedor...</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.razon_social}</option>
          ))}
        </select>
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          className="text-sm text-slate-700"
        />
        <button
          type="submit"
          disabled={procesando}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {procesando ? 'Procesando...' : 'Importar lista de precios'}
        </button>
      </form>

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      {resumen && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Resumen de la importación
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Precios actualizados</p>
              <p className="text-xl font-bold text-emerald-600">{resumen.actualizados}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Vinculados por código interno</p>
              <p className="text-xl font-bold text-emerald-600">{resumen.vinculadosPorCodigoInterno}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pendientes nuevas</p>
              <p className="text-xl font-bold text-amber-600">{resumen.pendientesNuevas}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Pendientes actualizadas</p>
              <p className="text-xl font-bold text-slate-700">{resumen.pendientesActualizadas}</p>
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
  )
}
