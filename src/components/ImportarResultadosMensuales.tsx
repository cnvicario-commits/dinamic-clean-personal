'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import { RUBROS, CAMPOS_CON_DETALLE, rubroSlugDeCampo, formatearMesAnio, clavePeriodo, type CampoResultado } from '@/types/resultados'

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

// Etiquetas tal como aparecen en la columna B del Excel de referencia
// (hoja "Resultado"), ya normalizadas: sin "-" inicial, sin espacios extra,
// en minúsculas. Ver normalizarConcepto().
const ETIQUETAS: { patron: string; campo: CampoResultado }[] = [
  { patron: 'dinamic', campo: 'ventas_dinamic' },
  { patron: 'moral', campo: 'ventas_moral' },
  { patron: 'total ventas', campo: 'total_ventas' },
  { patron: 'total costos directos', campo: 'total_costos_directos' },
  { patron: 'resultado bruto', campo: 'resultado_bruto' },
  { patron: 'total recursos humanos', campo: 'total_rrhh' },
  { patron: 'total estructura y servicios', campo: 'total_estructura_servicios' },
  { patron: 'total honorarios y abonos', campo: 'total_honorarios_abonos' },
  { patron: 'total gastos financieros', campo: 'total_gastos_financieros' },
  { patron: 'total gastos comerciales', campo: 'total_gastos_comerciales' },
  { patron: 'total otros gastos', campo: 'total_otros_gastos' },
  { patron: 'total impuestos', campo: 'total_impuestos' },
  { patron: 'resultado del periodo', campo: 'resultado_periodo' },
]

type Resumen = {
  creados: string[]
  actualizados: string[]
  etiquetasNoEncontradas: string[]
  filasDetalle: number
  avisos: string[]
}

// Normaliza un concepto de la columna B para comparar: recorta espacios,
// saca un "-" inicial (con o sin espacio después), colapsa espacios
// internos y pasa a minúsculas. No hace falta sacar tildes: ninguna de las
// 13 etiquetas buscadas las usa en el Excel de referencia.
function normalizarConcepto(texto: string): string {
  return texto.trim().replace(/^-+\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

// Mismo recorte que normalizarConcepto, pero SIN pasar a minúsculas: este
// texto se guarda tal cual para mostrarlo en el detalle desplegable
// (ej. "Sueldos Operarios"), no se usa para comparar.
function limpiarConcepto(texto: string): string {
  return texto.trim().replace(/^-+\s*/, '').replace(/\s+/g, ' ').trim()
}

function parseMesAnio(texto: string): { anio: number; mes: number } | null {
  const m = /^([a-záéíóúñ]+)\s+(\d{4})$/i.exec(texto.trim())
  if (!m) return null
  const mes = MESES[m[1].toLowerCase()]
  if (!mes) return null
  return { anio: Number(m[2]), mes }
}

function normalizarNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  if (typeof valor === 'number') return valor
  const texto = String(valor).trim().replace(',', '.')
  const n = Number(texto)
  return Number.isFinite(n) ? n : null
}

export default function ImportarResultadosMensuales() {
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
      setError('Elegí un archivo Excel (.xlsx).')
      return
    }

    setProcesando(true)
    try {
      const buffer = await archivo.arrayBuffer()
      const libro = XLSX.read(buffer, { type: 'array' })
      const nombreHoja = libro.SheetNames.find((n) => n.toLowerCase().includes('resultado'))
      if (!nombreHoja) {
        setError('No se encontró ninguna hoja llamada "Resultado" en el archivo.')
        setProcesando(false)
        return
      }
      const hoja = libro.Sheets[nombreHoja]
      const filas = XLSX.utils.sheet_to_json(hoja, { header: 1 }) as unknown[][]

      // Fila de encabezado: la primera cuya columna B sea exactamente "concepto".
      let indiceEncabezado = -1
      for (let i = 0; i < filas.length; i++) {
        if (String(filas[i]?.[1] ?? '').trim().toLowerCase() === 'concepto') {
          indiceEncabezado = i
          break
        }
      }
      if (indiceEncabezado === -1) {
        setError('No se encontró la fila de encabezado ("CONCEPTO" en la columna B). Verificá que sea la hoja correcta.')
        setProcesando(false)
        return
      }
      const encabezado = filas[indiceEncabezado]

      const avisos: string[] = []
      const columnasMes: { indice: number; anio: number; mes: number }[] = []
      for (let col = 2; col < encabezado.length; col++) {
        const texto = String(encabezado[col] ?? '').trim()
        if (!texto) continue // columna vacía al final
        if (texto.toLowerCase() === 'total') continue // columna de total, se ignora sin aviso
        const periodo = parseMesAnio(texto)
        if (!periodo) {
          avisos.push(`Columna no reconocida: "${texto}"`)
          continue
        }
        columnasMes.push({ indice: col, ...periodo })
      }

      if (columnasMes.length === 0) {
        setError('No se encontró ninguna columna de mes reconocible en el encabezado (formato esperado: "Enero 2026").')
        setProcesando(false)
        return
      }

      // Mapa etiqueta normalizada -> índice de fila, recorriendo toda la
      // columna B debajo del encabezado una sola vez (gana la primera
      // coincidencia si por algún motivo se repitiera).
      const filaPorEtiqueta = new Map<string, number>()
      for (let i = indiceEncabezado + 1; i < filas.length; i++) {
        const concepto = normalizarConcepto(String(filas[i]?.[1] ?? ''))
        if (concepto && !filaPorEtiqueta.has(concepto)) filaPorEtiqueta.set(concepto, i)
      }

      const etiquetasNoEncontradas: string[] = []
      const filaPorCampo = new Map<CampoResultado, number>()
      ETIQUETAS.forEach(({ patron, campo }) => {
        const fila = filaPorEtiqueta.get(patron)
        if (fila === undefined) {
          etiquetasNoEncontradas.push(patron)
        } else {
          filaPorCampo.set(campo, fila)
        }
      })

      const registros = columnasMes.map(({ indice, anio, mes }) => {
        const registro: Record<string, number | null> & { anio: number; mes: number } = { anio, mes }
        RUBROS.forEach(({ campo }) => {
          const filaIdx = filaPorCampo.get(campo)
          registro[campo] = filaIdx !== undefined ? normalizarNumero(filas[filaIdx][indice]) : null
        })
        return registro
      })

      // Detalle de cada rubro con desglose (Costos Directos, RRHH,
      // Estructura y Servicios, Honorarios y Abonos, Gastos Financieros,
      // Gastos Comerciales, Otros Gastos, Impuestos): todas las filas entre
      // el encabezado de sección (ej. "COSTOS DIRECTOS") y su "TOTAL X"
      // (sin incluir ninguna de las dos), leídas dinámicamente porque los
      // conceptos pueden variar mes a mes o año a año.
      const detalleRegistros: { anio: number; mes: number; rubro: string; concepto: string; monto: number }[] = []

      // Busca el encabezado de sección subiendo desde justo antes de su
      // propia fila "TOTAL X", no con el mapa de primera-coincidencia: un
      // concepto de detalle puede tener el mismo texto que el encabezado de
      // OTRA sección más abajo (ej. "Otros Gastos" es un concepto dentro de
      // Costos Directos Y el nombre de la sección "OTROS GASTOS"), así que
      // hay que quedarse con la ocurrencia más cercana al total, no la primera.
      function buscarEncabezadoCercano(desde: number, patron: string): number | undefined {
        for (let i = desde; i > indiceEncabezado; i--) {
          if (normalizarConcepto(String(filas[i]?.[1] ?? '')) === patron) return i
        }
        return undefined
      }

      CAMPOS_CON_DETALLE.forEach((campo) => {
        const entrada = ETIQUETAS.find((e) => e.campo === campo)
        if (!entrada) return
        const patronInicio = entrada.patron.replace(/^total /, '')
        const filaFin = filaPorEtiqueta.get(entrada.patron)
        const filaInicio = filaFin !== undefined ? buscarEncabezadoCercano(filaFin - 1, patronInicio) : undefined
        const rubro = rubroSlugDeCampo(campo)

        if (filaInicio === undefined || filaFin === undefined || filaFin <= filaInicio + 1) {
          avisos.push(`No se encontró el rango de detalle para "${entrada.patron}".`)
          return
        }

        for (let fi = filaInicio + 1; fi < filaFin; fi++) {
          const concepto = limpiarConcepto(String(filas[fi]?.[1] ?? ''))
          if (!concepto) continue // fila vacía
          const normalizado = concepto.toLowerCase()
          if (normalizado.startsWith('%') || normalizado.includes('incidencia')) continue // filas de porcentaje, no montos
          columnasMes.forEach(({ indice, anio, mes }) => {
            const monto = normalizarNumero(filas[fi][indice])
            if (monto === null) return // sin dato ese mes, no se guarda la fila
            detalleRegistros.push({ anio, mes, rubro, concepto, monto })
          })
        }
      })

      // Se consulta antes de guardar para poder distinguir en el resumen
      // qué meses son altas nuevas y cuáles ya existían (se actualizan).
      const { data: existentesData } = await supabase.from('resultados_mensuales').select('anio, mes')
      const existentesSet = new Set((existentesData ?? []).map((r) => clavePeriodo(r.anio, r.mes)))

      const { error: errUpsert } = await supabase
        .from('resultados_mensuales')
        .upsert(registros, { onConflict: 'anio,mes' })

      if (errUpsert) {
        setError('Error al guardar: ' + errUpsert.message)
        setProcesando(false)
        return
      }

      const creados = registros.filter((r) => !existentesSet.has(clavePeriodo(r.anio, r.mes)))
      const actualizados = registros.filter((r) => existentesSet.has(clavePeriodo(r.anio, r.mes)))

      // Reemplazo completo del detalle de cada mes/rubro (borrar + insertar,
      // no upsert parcial): así un concepto que desaparezca en una carga
      // posterior no queda huérfano de una carga anterior.
      const rubrosDetalle = CAMPOS_CON_DETALLE.map(rubroSlugDeCampo)
      await Promise.all(
        columnasMes.flatMap(({ anio, mes }) =>
          rubrosDetalle.map((rubro) =>
            supabase.from('resultados_mensuales_detalle').delete().eq('anio', anio).eq('mes', mes).eq('rubro', rubro)
          )
        )
      )
      if (detalleRegistros.length > 0) {
        const { error: errDetalle } = await supabase.from('resultados_mensuales_detalle').insert(detalleRegistros)
        if (errDetalle) avisos.push('Error al guardar el detalle por rubro: ' + errDetalle.message)
      }

      setResumen({
        creados: creados.map((r) => formatearMesAnio(r.anio, r.mes)),
        actualizados: actualizados.map((r) => formatearMesAnio(r.anio, r.mes)),
        etiquetasNoEncontradas,
        filasDetalle: detalleRegistros.length,
        avisos,
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
        {abierto ? 'Ocultar importación' : 'Importar desde Excel'}
      </button>

      {abierto && (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Subí el mismo Excel que ya se usa para calcular el resultado económico (hoja llamada &quot;Resultado&quot;). Se
            buscan los meses en la fila de encabezado (columna CONCEPTO en adelante, formato &quot;Enero 2026&quot;) y se
            guardan los totales por rubro, además del detalle interno de los rubros con desglose (Costos Directos,
            RRHH, Estructura y Servicios, Honorarios y Abonos, Gastos Financieros, Gastos Comerciales, Otros Gastos
            e Impuestos) para poder desplegarlos en el panel. La columna &quot;Total&quot; se ignora. Si ya existe un registro
            para un año/mes, se actualiza.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
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
              {procesando ? 'Procesando...' : 'Importar resultados'}
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
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Meses creados</p>
                  <p className="text-sm text-emerald-700">
                    {resumen.creados.length > 0 ? resumen.creados.join(', ') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Meses actualizados</p>
                  <p className="text-sm text-slate-700">
                    {resumen.actualizados.length > 0 ? resumen.actualizados.join(', ') : '-'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Filas de detalle guardadas (todos los rubros con desglose): {resumen.filasDetalle}
              </p>
              {resumen.etiquetasNoEncontradas.length > 0 && (
                <p className="text-sm text-amber-600 mb-1">
                  Etiquetas no encontradas en el archivo (quedaron en null): {resumen.etiquetasNoEncontradas.join(', ')}
                </p>
              )}
              {resumen.avisos.length > 0 && (
                <details>
                  <summary className="text-sm text-rose-600 cursor-pointer">
                    {resumen.avisos.length} aviso(s)
                  </summary>
                  <ul className="text-sm text-slate-600 mt-2 space-y-1">
                    {resumen.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
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
