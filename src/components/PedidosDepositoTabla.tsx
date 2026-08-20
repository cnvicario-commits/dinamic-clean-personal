'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import EstadoBadge from './EstadoBadge'
import type { PedidoDepositoListado, EstadoPedidoDeposito, ClienteResumen, Empresa } from '@/types/compras'

type Columna = 'numero_pedido_deposito' | 'empresa' | 'cliente' | 'estado' | 'alias' | 'creado_por' | 'fecha'

function comparar(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

function valorColumna(p: PedidoDepositoListado, columna: Columna): string {
  switch (columna) {
    case 'numero_pedido_deposito':
      return p.numero_pedido_deposito
    case 'empresa':
      return p.empresas?.nombre ?? ''
    case 'cliente':
      return p.clientes?.nombre ?? ''
    case 'estado':
      return p.estado
    case 'alias':
      return p.lugar_envio_alias ?? ''
    case 'creado_por':
      return p.creado_por_nombre ?? ''
    case 'fecha':
      return p.fecha
  }
}

export default function PedidosDepositoTabla({
  pedidos,
  clientes,
  empresas,
}: {
  pedidos: PedidoDepositoListado[]
  clientes: ClienteResumen[]
  empresas: Empresa[]
}) {
  const [filtroEstado, setFiltroEstado] = useState<'' | EstadoPedidoDeposito>('')
  const [filtroClienteId, setFiltroClienteId] = useState('')
  const [filtroEmpresaId, setFiltroEmpresaId] = useState('')
  const [columna, setColumna] = useState<Columna>('fecha')
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('desc')

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
    const signo = direccion === 'asc' ? 1 : -1
    return [...base].sort((a, b) => signo * comparar(valorColumna(a, columna), valorColumna(b, columna)))
  }, [pedidos, filtroEstado, filtroClienteId, filtroEmpresaId, columna, direccion])

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as '' | EstadoPedidoDeposito)} className={selectStyle}>
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="enviada">Enviada</option>
          <option value="recepcionada">Recepcionada</option>
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
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('numero_pedido_deposito')}>
                Número{indicador('numero_pedido_deposito')}
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
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('alias')}>
                Alias{indicador('alias')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('creado_por')}>
                Creado por{indicador('creado_por')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('fecha')}>
                Fecha{indicador('fecha')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  <Link href={`/pedidos-deposito/${p.id}`} className="text-teal-600 hover:underline">
                    {p.numero_pedido_deposito}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.empresas?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{p.clientes?.nombre ?? '-'}</td>
                <td className="px-4 py-3"><EstadoBadge estado={p.estado} /></td>
                <td className="px-4 py-3 text-slate-600">{p.lugar_envio_alias ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{p.creado_por_nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(`${p.fecha}T00:00:00`).toLocaleDateString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay pedidos a depósito que coincidan.</p>
      )}
    </div>
  )
}
