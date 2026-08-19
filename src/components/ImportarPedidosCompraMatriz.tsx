'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'
import DescargarPlantillaPedidosCompraMatriz from './DescargarPlantillaPedidosCompraMatriz'
import type { EmpresaResumen, ClienteResumen, ArticuloResumen, ClienteDomicilio } from '@/types/compras'

type ColumnaAlias = {
  indice: number
  domicilio: ClienteDomicilio
  lineas: { articulo_id: string; cantidad: number }[]
}

type FilaError = { fila: number | null; motivo: string }
type PedidoGenerado = { id: string; numero_pedido: string; cliente: string; alias: string }

type Resumen = {
  pedidosGenerados: PedidoGenerado[]
  errores: FilaError[]
}

const TAMANO_LOTE = 15

async function enLotes<T>(items: T[], tamano: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += tamano) {
    const lote = items.slice(i, i + tamano)
    await Promise.allSettled(lote.map(fn))
  }
}

function normalizarCantidad(valor: unknown): number {
  if (typeof valor === 'number') return valor
  const texto = String(valor ?? '').trim().replace(',', '.')
  return Number(texto)
}

export default function ImportarPedidosCompraMatriz({
  empresas,
  clientes,
  articulos,
  domicilios,
}: {
  empresas: EmpresaResumen[]
  clientes: ClienteResumen[]
  articulos: ArticuloResumen[]
  domicilios: ClienteDomicilio[]
}) {
  const [empresaId, setEmpresaId] = useState('')
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

    if (!empresaId) {
      setError('Elegí una empresa.')
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
      // header:1 en vez del sheet_to_json habitual: los encabezados de las
      // columnas de alias son dinámicos (no un set fijo de campos), así que
      // se procesan por índice de columna en vez de por nombre de clave.
      const filas = XLSX.utils.sheet_to_json(hoja, { header: 1 }) as unknown[][]

      if (filas.length < 2) {
        setError('El archivo no tiene filas de datos.')
        setProcesando(false)
        return
      }

      const encabezado = filas[0]
      const filasDatos = filas.slice(1)

      if (encabezado.length < 3) {
        setError('El archivo no tiene columnas de alias (a partir de la columna C). Usá la plantilla descargable.')
        setProcesando(false)
        return
      }

      const errores: FilaError[] = []

      // Columnas de alias, desde la C (índice 2) en adelante. El alias es
      // texto libre en cliente_domicilios (no hay constraint de unicidad en
      // la base): si el mismo alias matchea más de un domicilio, la columna
      // se reporta como error en vez de adivinar cuál usar.
      const columnas: ColumnaAlias[] = []
      for (let col = 2; col < encabezado.length; col++) {
        const aliasCrudo = String(encabezado[col] ?? '').trim()
        if (!aliasCrudo) continue // columna vacía al final del archivo

        const coincidencias = domicilios.filter((d) => d.alias.trim() === aliasCrudo)
        if (coincidencias.length === 0) {
          errores.push({ fila: null, motivo: `Columna "${aliasCrudo}": alias no encontrado` })
          continue
        }
        if (coincidencias.length > 1) {
          errores.push({ fila: null, motivo: `Columna "${aliasCrudo}": alias ambiguo (existe en más de un domicilio), se omite` })
          continue
        }
        columnas.push({ indice: col, domicilio: coincidencias[0], lineas: [] })
      }

      const mapaArticulosPorCodigo = new Map(articulos.map((a) => [a.codigo_interno, a.id]))

      filasDatos.forEach((fila, indice) => {
        const numeroFila = indice + 2 // fila 1 = encabezado
        const codigoInterno = String(fila[0] ?? '').trim()
        if (!codigoInterno) return // fila vacía/separadora, se ignora en silencio

        const articuloId = mapaArticulosPorCodigo.get(codigoInterno)
        if (!articuloId) {
          errores.push({ fila: numeroFila, motivo: `codigo_interno no encontrado: ${codigoInterno}` })
          return // toda la fila queda afuera, en todas las columnas
        }

        columnas.forEach((col) => {
          const cantidad = normalizarCantidad(fila[col.indice])
          if (Number.isFinite(cantidad) && cantidad > 0) {
            col.lineas.push({ articulo_id: articuloId, cantidad })
          }
        })
      })

      // Columnas sin ninguna cantidad cargada no generan pedido.
      const columnasConLineas = columnas.filter((c) => c.lineas.length > 0)

      const { data: userData } = await supabase.auth.getUser()
      const pedidosGenerados: PedidoGenerado[] = []

      await enLotes(columnasConLineas, TAMANO_LOTE, async (col) => {
        const { data: pedidoCreado, error: errInsert } = await supabase
          .from('pedidos_compra')
          .insert({
            empresa_id: empresaId,
            cliente_id: col.domicilio.cliente_id,
            observaciones_generales: null,
            lugar_envio_empresa: false,
            lugar_envio_domicilio_id: col.domicilio.id,
            lugar_envio_texto: col.domicilio.direccion,
            lugar_envio_alias: col.domicilio.alias,
            estado: 'borrador',
            creado_por: userData.user?.id,
          })
          .select('id, numero_pedido')
          .single()

        if (errInsert || !pedidoCreado) {
          errores.push({ fila: null, motivo: `Columna "${col.domicilio.alias}": error al crear el pedido: ${errInsert?.message ?? 'desconocido'}` })
          return
        }

        const { error: errItems } = await supabase.from('pedidos_compra_items').insert(
          col.lineas.map((l) => ({
            pedido_id: pedidoCreado.id,
            articulo_id: l.articulo_id,
            cantidad: l.cantidad,
            observaciones: null,
          }))
        )
        if (errItems) {
          errores.push({
            fila: null,
            motivo: `Columna "${col.domicilio.alias}": pedido ${pedidoCreado.numero_pedido} creado pero error al guardar las líneas: ${errItems.message}`,
          })
          return
        }

        pedidosGenerados.push({
          id: pedidoCreado.id,
          numero_pedido: pedidoCreado.numero_pedido,
          cliente: clientes.find((c) => c.id === col.domicilio.cliente_id)?.nombre ?? '-',
          alias: col.domicilio.alias,
        })
      })

      setResumen({ pedidosGenerados, errores })
      setArchivo(null)
      router.refresh()
    } catch (err) {
      setError('Error al procesar el archivo: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setProcesando(false)
    }
  }

  const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">
          Pensado para cargar varios pedidos de una sola vez (uno por cliente/domicilio). El Excel debe tener en
          la columna A el <code className="bg-slate-100 px-1 rounded">codigo_interno</code> del artículo, en la
          columna B el nombre (solo de referencia) y, desde la columna C en adelante, una columna por cada alias
          de domicilio de entrega con las cantidades pedidas debajo. Se genera un pedido en borrador por cada
          columna con al menos una cantidad cargada.
        </p>
        <DescargarPlantillaPedidosCompraMatriz articulos={articulos} />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
        <select
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          required
          className={`w-64 ${inputStyle}`}
        >
          <option value="">Elegí una empresa...</option>
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
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
          {procesando ? 'Procesando...' : 'Importar pedidos'}
        </button>
      </form>

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      {resumen && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Resumen de la importación
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            <span className="text-xl font-bold text-emerald-600">{resumen.pedidosGenerados.length}</span> pedido(s) generado(s)
          </p>
          {resumen.pedidosGenerados.length > 0 && (
            <ul className="text-sm text-slate-700 mb-3 space-y-1">
              {resumen.pedidosGenerados.map((p) => (
                <li key={p.id}>
                  <Link href={`/pedidos-compra/${p.id}`} className="text-teal-600 hover:underline">
                    {p.numero_pedido}
                  </Link>{' '}
                  — {p.cliente} ({p.alias})
                </li>
              ))}
            </ul>
          )}
          {resumen.errores.length > 0 && (
            <details>
              <summary className="text-sm text-rose-600 cursor-pointer">
                {resumen.errores.length} error(es)
              </summary>
              <ul className="text-sm text-slate-600 mt-2 space-y-1">
                {resumen.errores.map((e, i) => (
                  <li key={i}>{e.fila ? `Fila ${e.fila}: ` : ''}{e.motivo}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
