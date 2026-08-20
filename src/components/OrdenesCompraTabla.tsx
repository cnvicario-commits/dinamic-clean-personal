'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import EstadoBadge from './EstadoBadge'
import type { OrdenCompraListado, EstadoOrdenCompra, ClienteResumen, Empresa, ProveedorResumen } from '@/types/compras'

type Columna = 'numero_oc' | 'empresa' | 'proveedor' | 'cliente' | 'estado' | 'lugar_envio' | 'fecha'

function comparar(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

// Combina el alias del domicilio (o nombre de empresa) con la dirección
// congelada, ej. "Depósito Central — Av. Corrientes 1234" (mismo criterio
// que en el listado de Pedidos de compra).
function etiquetaLugarEnvio(o: OrdenCompraListado): string {
  if (o.lugar_envio_alias && o.lugar_envio_texto) return `${o.lugar_envio_alias} — ${o.lugar_envio_texto}`
  return o.lugar_envio_alias || o.lugar_envio_texto || ''
}

function valorColumna(o: OrdenCompraListado, columna: Columna): string {
  switch (columna) {
    case 'numero_oc':
      return o.numero_oc
    case 'empresa':
      return o.empresas?.nombre ?? ''
    case 'proveedor':
      return o.proveedores?.razon_social ?? ''
    case 'cliente':
      return o.clientes?.nombre ?? ''
    case 'estado':
      return o.estado
    case 'lugar_envio':
      return etiquetaLugarEnvio(o)
    case 'fecha':
      return o.fecha
  }
}

export default function OrdenesCompraTabla({
  ordenes,
  clientes,
  empresas,
  proveedores,
}: {
  ordenes: OrdenCompraListado[]
  clientes: ClienteResumen[]
  empresas: Empresa[]
  proveedores: ProveedorResumen[]
}) {
  const [filtroEstado, setFiltroEstado] = useState<'' | EstadoOrdenCompra>('')
  const [filtroClienteId, setFiltroClienteId] = useState('')
  const [filtroEmpresaId, setFiltroEmpresaId] = useState('')
  const [filtroProveedorId, setFiltroProveedorId] = useState('')
  const [columna, setColumna] = useState<Columna>('fecha')
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('desc')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

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
    let base = ordenes
    if (filtroEstado) base = base.filter((o) => o.estado === filtroEstado)
    if (filtroClienteId) base = base.filter((o) => o.cliente_id === filtroClienteId)
    if (filtroEmpresaId) base = base.filter((o) => o.empresa_id === filtroEmpresaId)
    if (filtroProveedorId) base = base.filter((o) => o.proveedor_id === filtroProveedorId)
    const signo = direccion === 'asc' ? 1 : -1
    return [...base].sort((a, b) => signo * comparar(valorColumna(a, columna), valorColumna(b, columna)))
  }, [ordenes, filtroEstado, filtroClienteId, filtroEmpresaId, filtroProveedorId, columna, direccion])

  function toggleSeleccionado(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // El checkbox del header selecciona/deselecciona las filas actualmente
  // filtradas (no necesariamente todas las órdenes de la lista completa).
  const todosFiltradosSeleccionados = filtrados.length > 0 && filtrados.every((o) => seleccionados.has(o.id))

  function toggleTodos() {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (todosFiltradosSeleccionados) {
        filtrados.forEach((o) => next.delete(o.id))
      } else {
        filtrados.forEach((o) => next.add(o.id))
      }
      return next
    })
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as '' | EstadoOrdenCompra)} className={selectStyle}>
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="enviada">Enviada</option>
          <option value="recepcionada">Recepcionada</option>
        </select>
        <select value={filtroProveedorId} onChange={(e) => setFiltroProveedorId(e.target.value)} className={selectStyle}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.razon_social}</option>
          ))}
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

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Listado ({filtrados.length})
        </h2>
        {seleccionados.size > 0 && (
          <Link
            href={`/ordenes-compra/imprimir?ids=${Array.from(seleccionados).join(',')}`}
            target="_blank"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Descargar seleccionadas ({seleccionados.size})
          </Link>
        )}
      </div>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium w-10">
                <input
                  type="checkbox"
                  checked={todosFiltradosSeleccionados}
                  onChange={toggleTodos}
                  aria-label="Seleccionar todas"
                />
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('numero_oc')}>
                Número{indicador('numero_oc')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('proveedor')}>
                Proveedor{indicador('proveedor')}
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
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('fecha')}>
                Fecha{indicador('fecha')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(o.id)}
                    onChange={() => toggleSeleccionado(o.id)}
                    aria-label={`Seleccionar ${o.numero_oc}`}
                  />
                </td>
                <td className="px-4 py-3 text-slate-800">
                  <Link href={`/ordenes-compra/${o.id}`} className="text-teal-600 hover:underline">
                    {o.numero_oc}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{o.proveedores?.razon_social ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{o.empresas?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{o.clientes?.nombre ?? '-'}</td>
                <td className="px-4 py-3"><EstadoBadge estado={o.estado} /></td>
                <td className="px-4 py-3 text-slate-600">{etiquetaLugarEnvio(o) || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(`${o.fecha}T00:00:00`).toLocaleDateString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay órdenes de compra que coincidan.</p>
      )}
    </div>
  )
}
