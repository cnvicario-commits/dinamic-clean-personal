'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import EstadoProcesamientoBadge from './EstadoProcesamientoBadge'
import type { PedidoEnviado } from '@/types/compras'

type Columna = 'numero_pedido' | 'empresa' | 'cliente' | 'creado_por' | 'created_at'

function comparar(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

function valorColumna(p: PedidoEnviado, columna: Columna): string {
  switch (columna) {
    case 'numero_pedido':
      return p.numero_pedido
    case 'empresa':
      return p.empresas?.nombre ?? ''
    case 'cliente':
      return p.clientes?.nombre ?? ''
    case 'creado_por':
      return p.creado_por_nombre ?? ''
    case 'created_at':
      return p.created_at
  }
}

export default function PedidosEnviadosTabla({ pedidos }: { pedidos: PedidoEnviado[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroProcesamiento, setFiltroProcesamiento] = useState<'' | 'pendiente' | 'procesado'>('')
  const [columna, setColumna] = useState<Columna>('created_at')
  // Más nuevo primero por defecto, para agilizar el proceso; coincide con el
  // orden que ya trae panel-compras/page.tsx desde el server.
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
    const q = busqueda.trim().toLowerCase()
    let base = q === ''
      ? pedidos
      : pedidos.filter(
          (p) =>
            p.numero_pedido.toLowerCase().includes(q) ||
            (p.clientes?.nombre ?? '').toLowerCase().includes(q)
        )
    if (filtroProcesamiento === 'pendiente') base = base.filter((p) => !p.procesado)
    else if (filtroProcesamiento === 'procesado') base = base.filter((p) => p.procesado)
    const signo = direccion === 'asc' ? 1 : -1
    return [...base].sort((a, b) => signo * comparar(valorColumna(a, columna), valorColumna(b, columna)))
  }, [pedidos, busqueda, filtroProcesamiento, columna, direccion])

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por número o cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-64"
        />
        <select
          value={filtroProcesamiento}
          onChange={(e) => setFiltroProcesamiento(e.target.value as '' | 'pendiente' | 'procesado')}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="procesado">Procesado</option>
        </select>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Pedidos enviados ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
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
              <th className="px-4 py-3 font-medium">Procesamiento</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('creado_por')}>
                Creado por{indicador('creado_por')}
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
                <td className="px-4 py-3 text-slate-800">{p.numero_pedido}</td>
                <td className="px-4 py-3 text-slate-600">{p.empresas?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{p.clientes?.nombre ?? '-'}</td>
                <td className="px-4 py-3"><EstadoProcesamientoBadge procesado={p.procesado} /></td>
                <td className="px-4 py-3 text-slate-600">{p.creado_por_nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(p.created_at).toLocaleDateString('es-AR')}</td>
                <td className="px-4 py-3">
                  <Link href={`/panel-compras/${p.id}`} className="text-teal-600 hover:underline text-sm">
                    Procesar
                  </Link>
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
