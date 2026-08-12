'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import EstadoBadge from './EstadoBadge'
import DuplicarPedidoCompraBoton from './DuplicarPedidoCompraBoton'
import type { PedidoCompraListado, EstadoPedidoCompra, ClienteResumen, Empresa } from '@/types/compras'

type Columna = 'numero_pedido' | 'empresa' | 'cliente' | 'estado' | 'lugar_envio' | 'created_at'

const SIN_LUGAR = '__sin_lugar__'

function comparar(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

// Combina el alias del domicilio (o nombre de empresa) con la dirección
// congelada, ej. "Depósito Central — Av. Corrientes 1234". Ambos son
// opcionales por separado (pedidos guardados antes de tener alias, o sin
// lugar de entrega elegido).
function etiquetaLugarEnvio(p: PedidoCompraListado): string {
  if (p.lugar_envio_alias && p.lugar_envio_texto) return `${p.lugar_envio_alias} — ${p.lugar_envio_texto}`
  return p.lugar_envio_alias || p.lugar_envio_texto || ''
}

function valorColumna(p: PedidoCompraListado, columna: Columna): string {
  switch (columna) {
    case 'numero_pedido':
      return p.numero_pedido
    case 'empresa':
      return p.empresas?.nombre ?? ''
    case 'cliente':
      return p.clientes?.nombre ?? ''
    case 'estado':
      return p.estado
    case 'lugar_envio':
      return etiquetaLugarEnvio(p)
    case 'created_at':
      return p.created_at
  }
}

export default function PedidosCompraTabla({
  pedidos,
  clientes,
  empresas,
}: {
  pedidos: PedidoCompraListado[]
  clientes: ClienteResumen[]
  empresas: Empresa[]
}) {
  const [filtroEstado, setFiltroEstado] = useState<'' | EstadoPedidoCompra>('')
  const [filtroClienteId, setFiltroClienteId] = useState('')
  const [filtroEmpresaId, setFiltroEmpresaId] = useState('')
  const [filtroLugarEnvio, setFiltroLugarEnvio] = useState('')
  const [columna, setColumna] = useState<Columna>('created_at')
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('desc')

  const lugaresEnvio = useMemo(() => {
    const valores = new Set(pedidos.map((p) => etiquetaLugarEnvio(p)).filter((v) => v !== ''))
    return Array.from(valores).sort(comparar)
  }, [pedidos])

  function ordenarPor(col: Columna) {
    if (columna === col) {
      setDireccion(direccion === 'asc' ? 'desc' : 'asc')
    } else {
      setColumna(col)
      setDireccion('asc')
    }
  }

  function indicador(col: Columna) {
    if (columna !== col) return ''
    return direccion === 'asc' ? ' ▲' : ' ▼'
  }

  const filtrados = useMemo(() => {
    let base = pedidos
    if (filtroEstado) base = base.filter((p) => p.estado === filtroEstado)
    if (filtroClienteId) base = base.filter((p) => p.cliente_id === filtroClienteId)
    if (filtroEmpresaId) base = base.filter((p) => p.empresa_id === filtroEmpresaId)
    if (filtroLugarEnvio === SIN_LUGAR) base = base.filter((p) => etiquetaLugarEnvio(p) === '')
    else if (filtroLugarEnvio) base = base.filter((p) => etiquetaLugarEnvio(p) === filtroLugarEnvio)
    const signo = direccion === 'asc' ? 1 : -1
    return [...base].sort((a, b) => signo * comparar(valorColumna(a, columna), valorColumna(b, columna)))
  }, [pedidos, filtroEstado, filtroClienteId, filtroEmpresaId, filtroLugarEnvio, columna, direccion])

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as '' | EstadoPedidoCompra)} className={selectStyle}>
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="enviada">Enviada</option>
        </select>
        <select value={filtroClienteId} onChange={(e) => setFiltroClienteId(e.target.value)} className={selectStyle}>
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <select value={filtroEmpresaId} onChange={(e) => setFiltroEmpresaId(e.target.value)} className={selectStyle}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
        <select value={filtroLugarEnvio} onChange={(e) => setFiltroLugarEnvio(e.target.value)} className={selectStyle}>
          <option value="">Todos los lugares de entrega</option>
          <option value={SIN_LUGAR}>Sin lugar especificado</option>
          {lugaresEnvio.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('numero_pedido')}>
                Número{indicador('numero_pedido')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('empresa')}>
                Empresa{indicador('empresa')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('cliente')}>
                Cliente{indicador('cliente')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('estado')}>
                Estado{indicador('estado')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('lugar_envio')}>
                Lugar de entrega{indicador('lugar_envio')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('created_at')}>
                Fecha{indicador('created_at')}
              </th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  <Link href={`/pedidos-compra/${p.id}`} className="text-teal-600 hover:underline">
                    {p.numero_pedido}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.empresas?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{p.clientes?.nombre ?? '-'}</td>
                <td className="px-4 py-3"><EstadoBadge estado={p.estado} /></td>
                <td className="px-4 py-3 text-slate-600">{etiquetaLugarEnvio(p) || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(p.created_at).toLocaleDateString('es-AR')}</td>
                <td className="px-4 py-3">
                  <DuplicarPedidoCompraBoton id={p.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay pedidos que coincidan.</p>
      )}
    </div>
  )
}
