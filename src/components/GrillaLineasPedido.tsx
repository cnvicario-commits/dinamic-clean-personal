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

// Grilla de carga de un pedido de compra, estilo Excel: todo el catálogo
// activo en una sola tabla, con cantidad/observaciones editables por fila.
// Los inputs son NO controlados (defaultValue + name) para no re-renderizar
// las ~300 filas en cada tecla; el valor final se lee con FormData al
// enviar el <form> (ver PedidoCompraForm.tsx). Por eso ocultar una fila por
// el filtro usa una clase CSS en vez de excluirla del array: FormData sigue
// leyendo inputs ocultos con display:none, así no se pierde lo ya tipeado
// al cambiar de filtro.
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

  // Catálogo plano, sin agrupar por categoría, ordenado alfabéticamente por
  // nombre (case-insensitive).
  const articulosOrdenados = useMemo(
    () => [...articulos].sort((a, b) => comparar(a.nombre, b.nombre)),
    [articulos]
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

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Artículos del catálogo ({articulos.length})
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
          <thead>
            <tr className="text-left text-slate-500">
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-medium border-b border-slate-200">Nombre</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-medium border-b border-slate-200">Categoría</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-medium border-b border-slate-200">Unidad</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-medium border-b border-slate-200 w-32">Cantidad</th>
              <th className="sticky top-0 z-10 bg-slate-50 px-4 py-3 font-medium border-b border-slate-200">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {articulosOrdenados.map((a) => {
              const visible = filaVisible(a)
              const inicial = valoresIniciales.get(a.id)
              return (
                <tr key={a.id} className={`border-b border-slate-100 last:border-0 ${visible ? '' : 'hidden'}`}>
                  <td className="px-4 py-2 text-slate-800">{a.nombre}</td>
                  <td className="px-4 py-2 text-slate-600">{a.categoria ?? '-'}</td>
                  <td className="px-4 py-2 text-slate-600">{a.unidad ?? '-'}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      name={`cantidad_${a.id}`}
                      defaultValue={inicial?.cantidad ?? ''}
                      className={inputStyle}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      name={`obs_${a.id}`}
                      defaultValue={inicial?.observaciones ?? ''}
                      className={inputStyle}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {huerfanosVisibles.length > 0 && (
        <div className="mt-4">
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
