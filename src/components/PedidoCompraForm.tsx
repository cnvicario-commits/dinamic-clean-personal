'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import BuscadorArticulo from './BuscadorArticulo'
import type {
  EmpresaResumen,
  ClienteResumen,
  ArticuloResumen,
  PedidoCompra,
  PedidoCompraItemConArticulo,
} from '@/types/compras'

type Linea = {
  clave: string
  articuloId: string
  articuloLabel: string
  cantidad: string
  observaciones: string
}

const inputStyle =
  'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

export default function PedidoCompraForm({
  empresas,
  clientes,
  articulos,
  pedido,
  items,
}: {
  empresas: EmpresaResumen[]
  clientes: ClienteResumen[]
  articulos: ArticuloResumen[]
  pedido?: PedidoCompra
  items?: PedidoCompraItemConArticulo[]
}) {
  const [empresaId, setEmpresaId] = useState(pedido?.empresa_id ?? '')
  const [clienteId, setClienteId] = useState(pedido?.cliente_id ?? '')
  const [observaciones, setObservaciones] = useState(pedido?.observaciones ?? '')
  const [lineas, setLineas] = useState<Linea[]>(
    (items ?? []).map((i) => ({
      clave: i.id,
      articuloId: i.articulo_id,
      articuloLabel: i.articulos ? `${i.articulos.codigo_interno} — ${i.articulos.nombre}` : 'Artículo',
      cantidad: String(i.cantidad),
      observaciones: i.observaciones ?? '',
    }))
  )

  // Campos del "agregar línea" (se resetean con este contador vía key).
  const [nuevoArticulo, setNuevoArticulo] = useState<{ id: string; label: string } | null>(null)
  const [nuevaCantidad, setNuevaCantidad] = useState('')
  const [nuevaObs, setNuevaObs] = useState('')
  const [resetKey, setResetKey] = useState(0)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  function agregarLinea() {
    setError('')
    if (!nuevoArticulo) {
      setError('Elegí un artículo antes de agregar la línea.')
      return
    }
    const cant = Number(nuevaCantidad)
    if (!cant || cant <= 0) {
      setError('La cantidad debe ser mayor a 0.')
      return
    }
    setLineas((prev) => [
      ...prev,
      {
        clave: crypto.randomUUID(),
        articuloId: nuevoArticulo.id,
        articuloLabel: nuevoArticulo.label,
        cantidad: nuevaCantidad,
        observaciones: nuevaObs,
      },
    ])
    setNuevoArticulo(null)
    setNuevaCantidad('')
    setNuevaObs('')
    setResetKey((k) => k + 1)
  }

  function quitarLinea(clave: string) {
    setLineas((prev) => prev.filter((l) => l.clave !== clave))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!empresaId || !clienteId) {
      setError('Elegí empresa y cliente.')
      return
    }
    if (lineas.length === 0) {
      setError('Agregá al menos una línea de artículo.')
      return
    }
    setLoading(true)

    const cabecera = {
      empresa_id: empresaId,
      cliente_id: clienteId,
      observaciones: observaciones || null,
    }

    let pedidoId = pedido?.id

    if (pedido) {
      const { error: errUpdate } = await supabase.from('pedidos_compra').update(cabecera).eq('id', pedido.id)
      if (errUpdate) {
        setLoading(false)
        setError('Error al guardar: ' + errUpdate.message)
        return
      }
      // Se reemplazan todas las líneas: más simple que diffear altas/bajas/cambios,
      // y seguro porque solo se puede editar mientras el pedido sigue en borrador.
      const { error: errDelete } = await supabase.from('pedidos_compra_items').delete().eq('pedido_compra_id', pedido.id)
      if (errDelete) {
        setLoading(false)
        setError('Error al guardar las líneas: ' + errDelete.message)
        return
      }
    } else {
      const { data, error: errInsert } = await supabase
        .from('pedidos_compra')
        .insert({ ...cabecera, estado: 'borrador' })
        .select('id')
        .single()
      if (errInsert || !data) {
        setLoading(false)
        setError('Error al guardar: ' + (errInsert?.message ?? 'desconocido'))
        return
      }
      pedidoId = data.id
    }

    const { error: errItems } = await supabase.from('pedidos_compra_items').insert(
      lineas.map((l) => ({
        pedido_compra_id: pedidoId,
        articulo_id: l.articuloId,
        cantidad: Number(l.cantidad),
        observaciones: l.observaciones || null,
      }))
    )
    setLoading(false)
    if (errItems) {
      setError('Error al guardar las líneas: ' + errItems.message)
      return
    }

    if (pedido) {
      router.refresh()
    } else {
      router.push(`/pedidos-compra/${pedidoId}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap gap-2 items-start">
        <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} required className={`flex-1 min-w-[200px] ${inputStyle}`}>
          <option value="">Seleccionar empresa</option>
          {empresas.map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
          ))}
        </select>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required className={`flex-1 min-w-[200px] ${inputStyle}`}>
          <option value="">Seleccionar cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>
      <textarea
        placeholder="Observaciones generales (opcional)"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        className={`w-full ${inputStyle}`}
        rows={2}
      />

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Líneas ({lineas.length})
        </h2>
        {lineas.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto mb-4">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Artículo</th>
                  <th className="px-4 py-3 font-medium">Cantidad</th>
                  <th className="px-4 py-3 font-medium">Observaciones</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.clave} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-800">{l.articuloLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{l.cantidad}</td>
                    <td className="px-4 py-3 text-slate-600">{l.observaciones || '-'}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => quitarLinea(l.clave)} className="text-rose-600 hover:underline text-sm">
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap gap-2 items-start">
          <div className="flex-1 min-w-[240px]">
            <BuscadorArticulo
              key={resetKey}
              articulos={articulos}
              onSeleccionar={(a) => setNuevoArticulo({ id: a.id, label: `${a.codigo_interno} — ${a.nombre}` })}
            />
          </div>
          <input
            type="number"
            min="0.01"
            step="any"
            placeholder="Cantidad"
            value={nuevaCantidad}
            onChange={(e) => setNuevaCantidad(e.target.value)}
            className={`w-32 ${inputStyle}`}
          />
          <input
            type="text"
            placeholder="Observaciones (opcional)"
            value={nuevaObs}
            onChange={(e) => setNuevaObs(e.target.value)}
            className={`flex-1 min-w-[180px] ${inputStyle}`}
          />
          <button
            type="button"
            onClick={agregarLinea}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Agregar línea
          </button>
        </div>
      </div>

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Guardando...' : pedido ? 'Guardar cambios' : 'Crear pedido'}
      </button>
    </form>
  )
}
