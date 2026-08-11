'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import GrillaLineasPedido from './GrillaLineasPedido'
import type {
  EmpresaConDomicilio,
  ClienteResumen,
  ArticuloResumen,
  ClienteDomicilio,
  PedidoCompra,
  PedidoCompraItemConArticulo,
} from '@/types/compras'

const inputStyle =
  'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

function lugarEnvioInicial(pedido?: PedidoCompra) {
  if (!pedido) return ''
  if (pedido.lugar_envio_empresa) return 'empresa'
  if (pedido.lugar_envio_domicilio_id) return `domicilio:${pedido.lugar_envio_domicilio_id}`
  return ''
}

export default function PedidoCompraForm({
  empresas,
  clientes,
  articulos,
  domicilios,
  pedido,
  items,
}: {
  empresas: EmpresaConDomicilio[]
  clientes: ClienteResumen[]
  articulos: ArticuloResumen[]
  domicilios: ClienteDomicilio[]
  pedido?: PedidoCompra
  items?: PedidoCompraItemConArticulo[]
}) {
  const [empresaId, setEmpresaId] = useState(pedido?.empresa_id ?? '')
  const [clienteId, setClienteId] = useState(pedido?.cliente_id ?? '')
  const [observaciones, setObservaciones] = useState(pedido?.observaciones_generales ?? '')
  const [lugarEnvio, setLugarEnvio] = useState(lugarEnvioInicial(pedido)) // '' | 'empresa' | `domicilio:<id>`

  const domiciliosDelCliente = domicilios.filter((d) => d.cliente_id === clienteId && d.activo)
  const empresaSeleccionada = empresas.find((e) => e.id === empresaId)

  // Texto congelado de la dirección elegida (igual que en OrdenCompraForm):
  // si el domicilio del cliente cambia después, el pedido ya emitido no se altera.
  function resolverLugarEnvioTexto(): string | null {
    if (lugarEnvio === 'empresa') return empresaSeleccionada?.domicilio || null
    if (lugarEnvio.startsWith('domicilio:')) {
      const dom = domicilios.find((d) => d.id === lugarEnvio.slice('domicilio:'.length))
      return dom?.direccion || null
    }
    return null
  }

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Se captura acá, antes de cualquier await: el evento sintético de React
    // no garantiza que currentTarget siga siendo válido después de un await.
    const formEl = e.currentTarget
    // Qué botón disparó el submit (API nativa del evento, mismo criterio que
    // ya usamos con FormData): decide si el pedido queda en borrador o pasa
    // directo a enviada, sin necesitar un paso separado después de guardar.
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const estadoDeseado: 'borrador' | 'enviada' = submitter?.value === 'enviar' ? 'enviada' : 'borrador'
    setError('')
    if (!empresaId || !clienteId) {
      setError('Elegí empresa y cliente.')
      return
    }
    if (estadoDeseado === 'enviada' && !confirm('¿Confirmás que querés guardar y enviar este pedido?')) {
      return
    }

    // La grilla usa inputs no controlados (name={`cantidad_${articuloId}`} /
    // `obs_${articuloId}`) para no re-renderizar ~300 filas por cada tecla;
    // acá se leen los valores finales del DOM vía FormData. Se revisan todos
    // los artículos activos MÁS los de líneas ya guardadas (por si alguno
    // fue dado de baja después y quedó en la sección de "huérfanos").
    const idsRelevantes = new Set<string>(articulos.map((a) => a.id))
    ;(items ?? []).forEach((i) => idsRelevantes.add(i.articulo_id))

    const fd = new FormData(formEl)
    const lineasFinales = Array.from(idsRelevantes)
      .map((articuloId) => ({
        articulo_id: articuloId,
        cantidad: Number(fd.get(`cantidad_${articuloId}`)),
        observaciones: String(fd.get(`obs_${articuloId}`) ?? '').trim() || null,
      }))
      // Vacío, 0 o negativo: se ignora en silencio, no genera línea ni error.
      .filter((l) => Number.isFinite(l.cantidad) && l.cantidad > 0)

    if (lineasFinales.length === 0) {
      setError('Cargá una cantidad en al menos un artículo.')
      return
    }
    setLoading(true)

    const cabecera = {
      empresa_id: empresaId,
      cliente_id: clienteId,
      observaciones_generales: observaciones || null,
      lugar_envio_empresa: lugarEnvio === 'empresa',
      lugar_envio_domicilio_id: lugarEnvio.startsWith('domicilio:') ? lugarEnvio.slice('domicilio:'.length) : null,
      lugar_envio_texto: resolverLugarEnvioTexto(),
      estado: estadoDeseado,
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
      const { error: errDelete } = await supabase.from('pedidos_compra_items').delete().eq('pedido_id', pedido.id)
      if (errDelete) {
        setLoading(false)
        setError('Error al guardar las líneas: ' + errDelete.message)
        return
      }
    } else {
      const { data: userData } = await supabase.auth.getUser()
      const { data, error: errInsert } = await supabase
        .from('pedidos_compra')
        .insert({ ...cabecera, creado_por: userData.user?.id })
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
      lineasFinales.map((l) => ({
        pedido_id: pedidoId,
        articulo_id: l.articulo_id,
        cantidad: l.cantidad,
        observaciones: l.observaciones,
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

      <GrillaLineasPedido articulos={articulos} items={items} />

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="accion"
          value="borrador"
          disabled={loading}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar borrador'}
        </button>
        <button
          type="submit"
          name="accion"
          value="enviar"
          disabled={loading}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar y enviar'}
        </button>
      </div>
    </form>
  )
}
