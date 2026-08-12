'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import BuscadorArticulo from './BuscadorArticulo'
import type { EmpresaConDomicilio, ClienteResumen, ProveedorResumen, ArticuloResumen, ClienteDomicilio } from '@/types/compras'

type PrecioProveedor = { articulo_id: string; proveedor_id: string; precio: number }

type Linea = {
  clave: string
  articuloId: string
  articuloLabel: string
  cantidad: string
  precioUnitario: string
  observaciones: string
}

const inputStyle =
  'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

export default function OrdenCompraForm({
  empresas,
  proveedores,
  clientes,
  articulos,
  preciosProveedor,
  domicilios,
}: {
  empresas: EmpresaConDomicilio[]
  proveedores: ProveedorResumen[]
  clientes: ClienteResumen[]
  articulos: ArticuloResumen[]
  preciosProveedor: PrecioProveedor[]
  domicilios: ClienteDomicilio[]
}) {
  const [empresaId, setEmpresaId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lugarEnvio, setLugarEnvio] = useState('') // '' | 'empresa' | `domicilio:<id>`
  const [condicionPago, setCondicionPago] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])

  const domiciliosDelCliente = domicilios.filter((d) => d.cliente_id === clienteId && d.activo)
  const empresaSeleccionada = empresas.find((e) => e.id === empresaId)

  function resolverLugarEnvioTexto(): string | null {
    if (lugarEnvio === 'empresa') return empresaSeleccionada?.domicilio || null
    if (lugarEnvio.startsWith('domicilio:')) {
      const dom = domicilios.find((d) => d.id === lugarEnvio.slice('domicilio:'.length))
      return dom?.direccion || null
    }
    return null
  }

  function resolverLugarEnvioAlias(): string | null {
    if (lugarEnvio === 'empresa') return empresaSeleccionada?.nombre || null
    if (lugarEnvio.startsWith('domicilio:')) {
      const dom = domicilios.find((d) => d.id === lugarEnvio.slice('domicilio:'.length))
      return dom?.alias || null
    }
    return null
  }

  // Horario del domicilio elegido como lugar de envío, congelado igual que
  // el texto/alias. La empresa no tiene concepto de horario de atención.
  function resolverHorarioAtencionTexto(): string | null {
    if (lugarEnvio.startsWith('domicilio:')) {
      const dom = domicilios.find((d) => d.id === lugarEnvio.slice('domicilio:'.length))
      return dom?.horario_atencion || null
    }
    return null
  }

  // Campos del "agregar línea" (se resetean con este contador vía key).
  const [nuevoArticulo, setNuevoArticulo] = useState<{ id: string; label: string } | null>(null)
  const [nuevaCantidad, setNuevaCantidad] = useState('')
  const [nuevoPrecioManual, setNuevoPrecioManual] = useState('')
  const [nuevaObs, setNuevaObs] = useState('')
  const [resetKey, setResetKey] = useState(0)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const precioCatalogo = useMemo(() => {
    if (!proveedorId || !nuevoArticulo) return null
    const fila = preciosProveedor.find((p) => p.proveedor_id === proveedorId && p.articulo_id === nuevoArticulo.id)
    return fila?.precio ?? null
  }, [proveedorId, nuevoArticulo, preciosProveedor])

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
    const precio = precioCatalogo ?? Number(nuevoPrecioManual)
    if (!precio || precio <= 0) {
      setError('Ingresá un precio unitario válido.')
      return
    }
    setLineas((prev) => [
      ...prev,
      {
        clave: crypto.randomUUID(),
        articuloId: nuevoArticulo.id,
        articuloLabel: nuevoArticulo.label,
        cantidad: nuevaCantidad,
        precioUnitario: String(precio),
        observaciones: nuevaObs,
      },
    ])
    setNuevoArticulo(null)
    setNuevaCantidad('')
    setNuevoPrecioManual('')
    setNuevaObs('')
    setResetKey((k) => k + 1)
  }

  function quitarLinea(clave: string) {
    setLineas((prev) => prev.filter((l) => l.clave !== clave))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!empresaId || !proveedorId || !clienteId) {
      setError('Elegí empresa, proveedor y cliente.')
      return
    }
    if (lineas.length === 0) {
      setError('Agregá al menos una línea de artículo.')
      return
    }
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const { data: nuevo, error: errInsert } = await supabase
      .from('ordenes_compra')
      .insert({
        empresa_id: empresaId,
        proveedor_id: proveedorId,
        cliente_id: clienteId,
        pedido_id: null, // OC generada directamente, sin pedido de compra de origen
        observaciones_generales: observaciones || null,
        lugar_envio_texto: resolverLugarEnvioTexto(),
        lugar_envio_alias: resolverLugarEnvioAlias(),
        horario_atencion_texto: resolverHorarioAtencionTexto(),
        condicion_pago: condicionPago || null,
        estado: 'borrador',
        creado_por: userData.user?.id,
      })
      .select('id')
      .single()

    if (errInsert || !nuevo) {
      setLoading(false)
      setError('Error al guardar: ' + (errInsert?.message ?? 'desconocido'))
      return
    }

    const { error: errItems } = await supabase.from('ordenes_compra_items').insert(
      lineas.map((l) => ({
        oc_id: nuevo.id,
        pedido_compra_item_id: null,
        articulo_id: l.articuloId,
        cantidad: Number(l.cantidad),
        precio_unitario: Number(l.precioUnitario),
        observaciones: l.observaciones || null,
      }))
    )
    setLoading(false)
    if (errItems) {
      setError('Error al guardar las líneas: ' + errItems.message)
      return
    }

    router.push(`/ordenes-compra/${nuevo.id}`)
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
        <select
          value={proveedorId}
          onChange={(e) => {
            const id = e.target.value
            setProveedorId(id)
            // Precarga desde el default del proveedor; el campo sigue editable
            // después para ese caso puntual, sin afectar el valor del proveedor.
            setCondicionPago(proveedores.find((p) => p.id === id)?.condicion_pago_default ?? '')
          }}
          required
          className={`flex-1 min-w-[200px] ${inputStyle}`}
        >
          <option value="">Seleccionar proveedor</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.razon_social}</option>
          ))}
        </select>
        <select
          value={clienteId}
          onChange={(e) => {
            setClienteId(e.target.value)
            setLugarEnvio('') // el domicilio elegido puede no pertenecer al nuevo cliente
          }}
          required
          className={`flex-1 min-w-[200px] ${inputStyle}`}
        >
          <option value="">Seleccionar cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      <input
        type="text"
        placeholder="Condición de pago (opcional)"
        value={condicionPago}
        onChange={(e) => setCondicionPago(e.target.value)}
        className={`w-full ${inputStyle}`}
      />

      <select value={lugarEnvio} onChange={(e) => setLugarEnvio(e.target.value)} className={`w-full ${inputStyle}`}>
        <option value="">Lugar de envío (opcional)</option>
        {domiciliosDelCliente.length > 0 && (
          <optgroup label="Domicilios del cliente">
            {domiciliosDelCliente.map((d) => (
              <option key={d.id} value={`domicilio:${d.id}`}>{d.alias} — {d.direccion}</option>
            ))}
          </optgroup>
        )}
        {empresaSeleccionada?.domicilio && (
          <optgroup label="Empresa">
            <option value="empresa">{empresaSeleccionada.nombre} — {empresaSeleccionada.domicilio}</option>
          </optgroup>
        )}
      </select>

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
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-3 font-medium">Artículo</th>
                  <th className="px-4 py-3 font-medium">Cantidad</th>
                  <th className="px-4 py-3 font-medium">Precio unitario</th>
                  <th className="px-4 py-3 font-medium">Observaciones</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.clave} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-800">{l.articuloLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{l.cantidad}</td>
                    <td className="px-4 py-3 text-slate-600">
                      $ {Number(l.precioUnitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
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

        {!proveedorId ? (
          <p className="text-sm text-slate-500">Elegí un proveedor para poder agregar líneas.</p>
        ) : (
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
            {precioCatalogo !== null ? (
              <span className="px-3 py-2 text-sm text-slate-600">
                Precio: $ {precioCatalogo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            ) : (
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="Precio unitario (manual)"
                value={nuevoPrecioManual}
                onChange={(e) => setNuevoPrecioManual(e.target.value)}
                className={`w-44 ${inputStyle}`}
              />
            )}
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
            {nuevoArticulo && precioCatalogo === null && (
              <p className="text-amber-600 text-sm w-full">
                Sin precio cargado para este proveedor y artículo. Ingresalo manualmente.
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Crear orden de compra'}
      </button>
    </form>
  )
}
