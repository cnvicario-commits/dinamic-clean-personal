'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { PedidoCompraListado } from '@/types/compras'

type Columna = 'numero_pedido' | 'empresa' | 'cliente' | 'created_at'

function comparar(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

function valorColumna(p: PedidoCompraListado, columna: Columna): string {
  switch (columna) {
    case 'numero_pedido':
      return p.numero_pedido
    case 'empresa':
      return p.empresas?.nombre ?? ''
    case 'cliente':
      return p.clientes?.nombre ?? ''
    case 'created_at':
      return p.created_at
  }
}

export default function PedidosEnviadosTabla({ pedidos }: { pedidos: PedidoCompraListado[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [columna, setColumna] = useState<Columna>('created_at')
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('asc')

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
    const base = q === ''
      ? pedidos
      : pedidos.filter(
          (p) =>
            p.numero_pedido.toLowerCase().includes(q) ||
            (p.clientes?.nombre ?? '').toLowerCase().includes(q)
        )
    const signo = direccion === 'asc' ? 1 : -1
    return [...base].sort((a, b) => signo * comparar(valorColumna(a, columna), valorColumna(b, columna)))
  }, [pedidos, busqueda, columna, direccion])

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
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Pendientes de procesar ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
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
        <p className="text-slate-500 text-sm mt-3">No hay pedidos pendientes de procesar.</p>
      )}
    </div>
  )
}
