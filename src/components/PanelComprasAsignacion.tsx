'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { AsignacionPendiente, LineaPendiente, ProveedorResumen } from '@/types/compras'

const inputStyle =
  'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

type PrecioProveedor = { articulo_id: string; proveedor_id: string; precio: number }

function LineaAsignacionForm({
  linea,
  pendienteRestante,
  proveedores,
  preciosProveedor,
  onAgregar,
}: {
  linea: LineaPendiente
  pendienteRestante: number
  proveedores: ProveedorResumen[]
  preciosProveedor: PrecioProveedor[]
  onAgregar: (a: AsignacionPendiente) => void
}) {
  const [cantidad, setCantidad] = useState('')
  const [destino, setDestino] = useState<'proveedor' | 'deposito'>('proveedor')
  const [proveedorId, setProveedorId] = useState('')
  const [precioManual, setPrecioManual] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')

  const precioCatalogo = useMemo(() => {
    if (!proveedorId) return null
    const fila = preciosProveedor.find((p) => p.proveedor_id === proveedorId && p.articulo_id === linea.articulo_id)
    return fila?.precio ?? null
  }, [proveedorId, preciosProveedor, linea.articulo_id])

  if (pendienteRestante <= 0) {
    return (
      <p className="text-sm text-emerald-600">Cantidad totalmente asignada.</p>
    )
  }

  function agregar() {
    setError('')
    const cant = Number(cantidad)
    if (!cant || cant <= 0) {
      setError('Ingresá una cantidad mayor a 0.')
      return
    }
    if (cant > pendienteRestante) {
      setError(`No podés asignar más de lo pendiente (${pendienteRestante}).`)
      return
    }
    if (destino === 'proveedor') {
      if (!proveedorId) {
        setError('Elegí un proveedor.')
        return
      }
      const precio = precioCatalogo ?? Number(precioManual)
      if (!precio || precio <= 0) {
        setError('Ingresá un precio válido para este proveedor.')
        return
      }
      const proveedor = proveedores.find((p) => p.id === proveedorId)
      onAgregar({
        clave: crypto.randomUUID(),
        pedidoCompraItemId: linea.id,
        articulo: linea.articulos!,
        cantidad: cant,
        destino: 'proveedor',
        proveedorId,
        proveedorNombre: proveedor?.razon_social ?? null,
        precioUnitario: precio,
        observaciones,
      })
    } else {
      onAgregar({
        clave: crypto.randomUUID(),
        pedidoCompraItemId: linea.id,
        articulo: linea.articulos!,
        cantidad: cant,
        destino: 'deposito',
        proveedorId: null,
        proveedorNombre: null,
        precioUnitario: null,
        observaciones,
      })
    }
    setCantidad('')
    setProveedorId('')
    setPrecioManual('')
    setObservaciones('')
  }

  return (
    <div className="flex flex-wrap gap-2 items-start">
      <input
        type="number"
        min="0.01"
        step="any"
        placeholder={`Cantidad (pend. ${pendienteRestante})`}
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
        className={`w-40 ${inputStyle}`}
      />
      <select value={destino} onChange={(e) => setDestino(e.target.value as 'proveedor' | 'deposito')} className={inputStyle}>
        <option value="proveedor">Orden de compra</option>
        <option value="deposito">Pedido a depósito</option>
      </select>
      {destino === 'proveedor' && (
        <>
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className={`min-w-[180px] ${inputStyle}`}>
            <option value="">Seleccionar proveedor</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.razon_social}</option>
            ))}
          </select>
          {proveedorId && precioCatalogo === null && (
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="Precio unitario (manual)"
              value={precioManual}
              onChange={(e) => setPrecioManual(e.target.value)}
              className={`w-44 ${inputStyle}`}
            />
          )}
          {proveedorId && precioCatalogo !== null && (
            <span className="px-3 py-2 text-sm text-slate-600">
              Precio: $ {precioCatalogo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </>
      )}
      <input
        type="text"
        placeholder="Observaciones (opcional)"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        className={`flex-1 min-w-[160px] ${inputStyle}`}
      />
      <button
        type="button"
        onClick={agregar}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Agregar a la lista
      </button>
      {destino === 'proveedor' && proveedorId && precioCatalogo === null && (
        <p className="text-amber-600 text-sm w-full">
          Sin precio cargado para este proveedor. El precio que ingreses se usa solo para esta orden de compra.
        </p>
      )}
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </div>
  )
}

export default function PanelComprasAsignacion({
  pedidoId,
  empresaId,
  clienteId,
  lineas,
  proveedores,
  preciosProveedor,
}: {
  pedidoId: string
  empresaId: string
  clienteId: string
  lineas: LineaPendiente[]
  proveedores: ProveedorResumen[]
  preciosProveedor: PrecioProveedor[]
}) {
  const [asignaciones, setAsignaciones] = useState<AsignacionPendiente[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const pendientePorLinea = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const l of lineas) {
      const enCola = asignaciones
        .filter((a) => a.pedidoCompraItemId === l.id)
        .reduce((acc, a) => acc + a.cantidad, 0)
      mapa.set(l.id, l.cantidad_pendiente - enCola)
    }
    return mapa
  }, [lineas, asignaciones])

  function quitar(clave: string) {
    setAsignaciones((prev) => prev.filter((a) => a.clave !== clave))
  }

  async function confirmar() {
    setError('')
    setGuardando(true)

    const { data: userData } = await supabase.auth.getUser()

    const grupos = new Map<string, AsignacionPendiente[]>()
    for (const a of asignaciones) {
      const clave = a.destino === 'deposito' ? 'DEPOSITO' : a.proveedorId!
      grupos.set(clave, [...(grupos.get(clave) ?? []), a])
    }

    for (const [clave, items] of grupos) {
      if (clave === 'DEPOSITO') {
        const { data: nuevo, error: errCab } = await supabase
          .from('pedidos_deposito')
          .insert({
            empresa_id: empresaId,
            cliente_id: clienteId,
            pedido_id: pedidoId,
            estado: 'borrador',
            creado_por: userData.user?.id,
          })
          .select('id')
          .single()
        if (errCab || !nuevo) {
          setGuardando(false)
          setError('Error al crear el pedido a depósito: ' + (errCab?.message ?? 'desconocido'))
          return
        }
        const { error: errItems } = await supabase.from('pedidos_deposito_items').insert(
          items.map((i) => ({
            pedido_deposito_id: nuevo.id,
            pedido_compra_item_id: i.pedidoCompraItemId,
            articulo_id: i.articulo.id,
            cantidad: i.cantidad,
            observaciones: i.observaciones || null,
          }))
        )
        if (errItems) {
          setGuardando(false)
          setError('Error al guardar las líneas del pedido a depósito: ' + errItems.message)
          return
        }
      } else {
        const { data: nuevo, error: errCab } = await supabase
          .from('ordenes_compra')
          .insert({
            empresa_id: empresaId,
            proveedor_id: clave,
            cliente_id: clienteId,
            pedido_id: pedidoId,
            estado: 'borrador',
            creado_por: userData.user?.id,
          })
          .select('id')
          .single()
        if (errCab || !nuevo) {
          setGuardando(false)
          setError('Error al crear la orden de compra: ' + (errCab?.message ?? 'desconocido'))
          return
        }
        const { error: errItems } = await supabase.from('ordenes_compra_items').insert(
          items.map((i) => ({
            oc_id: nuevo.id,
            pedido_compra_item_id: i.pedidoCompraItemId,
            articulo_id: i.articulo.id,
            cantidad: i.cantidad,
            precio_unitario: i.precioUnitario,
            observaciones: i.observaciones || null,
          }))
        )
        if (errItems) {
          setGuardando(false)
          setError('Error al guardar las líneas de la orden de compra: ' + errItems.message)
          return
        }
      }
    }

    setGuardando(false)
    setAsignaciones([])
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Líneas del pedido
        </h2>
        <div className="space-y-4">
          {lineas.map((l) => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-medium text-slate-800">
                  {l.articulos ? `${l.articulos.codigo_interno} — ${l.articulos.nombre}` : 'Artículo'}
                </p>
                <p className="text-xs text-slate-500">
                  Pedido: {l.cantidad} · Asignado a OC: {l.cantidad_asignada_oc} · Asignado a depósito: {l.cantidad_asignada_deposito}
                  {' · '}
                  <span className="font-medium text-slate-700">
                    Pendiente: {pendientePorLinea.get(l.id) ?? l.cantidad_pendiente}
                  </span>
                </p>
              </div>
              <LineaAsignacionForm
                linea={l}
                pendienteRestante={pendientePorLinea.get(l.id) ?? l.cantidad_pendiente}
                proveedores={proveedores}
                preciosProveedor={preciosProveedor}
                onAgregar={(a) => setAsignaciones((prev) => [...prev, a])}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Asignaciones a confirmar ({asignaciones.length})
        </h2>
        {asignaciones.length === 0 ? (
          <p className="text-slate-500 text-sm">Todavía no agregaste ninguna asignación.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Artículo</th>
                  <th className="px-4 py-3 font-medium">Cantidad</th>
                  <th className="px-4 py-3 font-medium">Destino</th>
                  <th className="px-4 py-3 font-medium">Precio</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((a) => (
                  <tr key={a.clave} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-800">{a.articulo.codigo_interno} — {a.articulo.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{a.cantidad}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.destino === 'deposito' ? 'Depósito' : a.proveedorNombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.precioUnitario != null ? `$ ${a.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => quitar(a.clave)} className="text-rose-600 hover:underline text-sm">
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="text-rose-600 text-sm mt-3">{error}</p>}

        <button
          onClick={confirmar}
          disabled={asignaciones.length === 0 || guardando}
          className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {guardando ? 'Confirmando...' : 'Confirmar asignaciones'}
        </button>
      </div>
    </div>
  )
}
