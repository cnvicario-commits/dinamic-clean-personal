'use client'

import { useMemo, useState } from 'react'
import type { ArticuloResumen, PedidoCompraItemConArticulo } from '@/types/compras'

const inputStyle =
  'px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-full'

// Sin distinguir mayúsculas/minúsculas ni acentos, mismo criterio que
// ArticulosTabla.tsx (el server ordena por nombre pero de forma sensible a
// mayúsculas, así que se reordena en el cliente).
function comparar(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

// Fila de artículo compartida entre la sección "Artículos del pedido" y el
// resto del catálogo. Inputs NO controlados (defaultValue + name) para no
// re-renderizar ~300 filas en cada tecla; el valor final se lee con
// FormData al enviar el <form> (ver PedidoCompraForm.tsx). `oculto` usa una
// clase CSS en vez de excluir la fila del array: FormData sigue leyendo
// inputs ocultos con display:none, así no se pierde lo ya tipeado al
// cambiar de filtro.
function FilaArticulo({
  articulo,
  inicial,
  oculto,
}: {
  articulo: ArticuloResumen
  inicial?: { cantidad: string; observaciones: string }
  oculto?: boolean
}) {
  return (
    <tr className={`border-b border-slate-100 last:border-0 ${oculto ? 'hidden' : ''}`}>
      <td className="px-4 py-2 text-slate-800">{articulo.nombre}</td>
      <td className="px-4 py-2 text-slate-600">{articulo.categoria ?? '-'}</td>
      <td className="px-4 py-2 text-slate-600">{articulo.unidad ?? '-'}</td>
      <td className="px-4 py-2">
        <input
          type="number"
          step="any"
          min="0"
          name={`cantidad_${articulo.id}`}
          defaultValue={inicial?.cantidad ?? ''}
          className={inputStyle}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          name={`obs_${articulo.id}`}
          defaultValue={inicial?.observaciones ?? ''}
          className={inputStyle}
        />
      </td>
    </tr>
  )
}

// Grilla de carga de un pedido de compra, estilo Excel. Cuando el pedido ya
// trae líneas cargadas (edición de un borrador, o un pedido recién
// duplicado), esos artículos se muestran primero en una sección aparte
// ("Artículos del pedido"), siempre visibles sin importar la búsqueda, para
// que sea lo primero que se vea al entrar — antes quedaban mezclados sin
// distinción en medio de todo el catálogo. Debajo, el resto del catálogo
// para agregar más artículos.
export default function GrillaLineasPedido({
  articulos,
  items,
}: {
  articulos: ArticuloResumen[]
  items?: PedidoCompraItemConArticulo[]
}) {
  const [busqueda, setBusqueda] = useState('')

  const valoresIniciales = useMemo(() => {
    const mapa = new Map<string, { cantidad: string; observaciones: string }>()
    ;(items ?? []).forEach((i) => {
      mapa.set(i.articulo_id, { cantidad: String(i.cantidad), observaciones: i.observaciones ?? '' })
    })
    return mapa
  }, [items])

  const articulosPedidos = useMemo(
    () => [...articulos].filter((a) => valoresIniciales.has(a.id)).sort((a, b) => comparar(a.nombre, b.nombre)),
    [articulos, valoresIniciales]
  )
  const articulosDisponibles = useMemo(
    () => [...articulos].filter((a) => !valoresIniciales.has(a.id)).sort((a, b) => comparar(a.nombre, b.nombre)),
    [articulos, valoresIniciales]
  )

  // Líneas de artículos que ya no están activos: pedidos_compra_items no
  // filtra por activo, así que al editar/duplicar un pedido puede traer una
  // cantidad cargada para un artículo dado de baja después. Si no se
  // muestran, esa cantidad se perdería en silencio al guardar (la grilla
  // principal solo itera el catálogo activo).
  const activosIds = useMemo(() => new Set(articulos.map((a) => a.id)), [articulos])
  const huerfanos = useMemo(
    () => (items ?? []).filter((i) => !activosIds.has(i.articulo_id)),
    [items, activosIds]
  )
  const [huerfanosVisibles, setHuerfanosVisibles] = useState(() => huerfanos.map((h) => h.articulo_id))

  const q = busqueda.trim().toLowerCase()

  function filaVisible(a: ArticuloResumen) {
    return q === '' || a.nombre.toLowerCase().includes(q) || a.codigo_interno.toLowerCase().includes(q)
  }

  const encabezadoTabla = (colorFondo: string, colorBorde: string) => (
    <tr className="text-left text-slate-500">
      <th className={`sticky top-0 z-10 ${colorFondo} px-4 py-3 font-medium border-b ${colorBorde}`}>Nombre</th>
      <th className={`sticky top-0 z-10 ${colorFondo} px-4 py-3 font-medium border-b ${colorBorde}`}>Categoría</th>
      <th className={`sticky top-0 z-10 ${colorFondo} px-4 py-3 font-medium border-b ${colorBorde}`}>Unidad</th>
      <th className={`sticky top-0 z-10 ${colorFondo} px-4 py-3 font-medium border-b ${colorBorde} w-32`}>Cantidad</th>
      <th className={`sticky top-0 z-10 ${colorFondo} px-4 py-3 font-medium border-b ${colorBorde}`}>Observaciones</th>
    </tr>
  )

  return (
    <div className="flex flex-col gap-6">
      {articulosPedidos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-teal-700 uppercase tracking-wide mb-1">
            Artículos del pedido ({articulosPedidos.length})
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            Ya tienen cantidad cargada. Modificalas si hace falta, o dejalas en 0/vacío para sacar esa línea del pedido.
          </p>
          <div className="bg-teal-50/40 border border-teal-200 rounded-lg shadow-sm overflow-auto max-h-[40vh]">
            <table className="w-full text-sm min-w-[720px]">
              <thead>{encabezadoTabla('bg-teal-50', 'border-teal-200')}</thead>
              <tbody>
                {articulosPedidos.map((a) => (
                  <FilaArticulo key={a.id} articulo={a} inicial={valoresIniciales.get(a.id)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          {articulosPedidos.length > 0 ? 'Agregar más artículos' : 'Artículos del catálogo'} ({articulosDisponibles.length})
        </h2>

        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            placeholder="Buscar por nombre o código interno..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[220px]"
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-auto max-h-[65vh]">
          <table className="w-full text-sm min-w-[720px]">
            <thead>{encabezadoTabla('bg-slate-50', 'border-slate-200')}</thead>
            <tbody>
              {articulosDisponibles.map((a) => (
                <FilaArticulo key={a.id} articulo={a} oculto={!filaVisible(a)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {huerfanosVisibles.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
            Artículos dados de baja con cantidad cargada
          </h3>
          <p className="text-xs text-slate-500 mb-2">
            Estas líneas quedaron de una carga anterior; el artículo ya no está activo en el catálogo.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <tbody>
                {huerfanos
                  .filter((h) => huerfanosVisibles.includes(h.articulo_id))
                  .map((h) => (
                    <tr key={h.id} className="border-b border-amber-100 last:border-0">
                      <td className="px-4 py-2 text-slate-800">
                        {h.articulos ? `${h.articulos.codigo_interno} — ${h.articulos.nombre}` : 'Artículo eliminado'}
                      </td>
                      <td className="px-4 py-2 w-32">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          name={`cantidad_${h.articulo_id}`}
                          defaultValue={String(h.cantidad)}
                          className={inputStyle}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          name={`obs_${h.articulo_id}`}
                          defaultValue={h.observaciones ?? ''}
                          className={inputStyle}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setHuerfanosVisibles((prev) => prev.filter((id) => id !== h.articulo_id))}
                          className="text-rose-600 hover:underline text-sm"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
