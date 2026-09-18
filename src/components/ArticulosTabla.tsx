'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ArticuloEstadoBoton from './ArticuloEstadoBoton'

type Articulo = {
  id: string
  codigo_interno: string
  nombre: string
  categoria: string | null
  unidad: string | null
  activo: boolean
  proveedor_habitual_id: string | null
}

type ProveedorResumen = { id: string; razon_social: string }

type Columna = 'codigo_interno' | 'nombre' | 'categoria' | 'unidad' | 'proveedor_habitual'

const SIN_PROVEEDOR_HABITUAL = '__sin_proveedor__'

// Comparación alfabética sin distinguir mayúsculas/minúsculas ni acentos,
// para que un nombre cargado en minúscula (ej: "pinza") no quede aislado
// al final de la lista por una comparación sensible a mayúsculas.
function comparar(a: string | null, b: string | null) {
  return (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base' })
}

export default function ArticulosTabla({
  articulos,
  proveedores,
  onEditar,
}: {
  articulos: Articulo[]
  proveedores: ProveedorResumen[]
  onEditar: (a: Articulo) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [proveedorFiltro, setProveedorFiltro] = useState('')
  const [columna, setColumna] = useState<Columna>('nombre')
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('asc')

  const nombreProveedorPorId = useMemo(
    () => new Map(proveedores.map((p) => [p.id, p.razon_social])),
    [proveedores]
  )

  function nombreProveedorHabitual(a: Articulo) {
    return a.proveedor_habitual_id ? nombreProveedorPorId.get(a.proveedor_habitual_id) ?? '' : ''
  }

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
      ? articulos
      : articulos.filter(
          (a) => a.nombre.toLowerCase().includes(q) || a.codigo_interno.toLowerCase().includes(q)
        )
    if (proveedorFiltro === SIN_PROVEEDOR_HABITUAL) {
      base = base.filter((a) => !a.proveedor_habitual_id)
    } else if (proveedorFiltro !== '') {
      base = base.filter((a) => a.proveedor_habitual_id === proveedorFiltro)
    }
    const signo = direccion === 'asc' ? 1 : -1
    const valor = (a: Articulo, col: Columna) =>
      col === 'proveedor_habitual'
        ? a.proveedor_habitual_id
          ? nombreProveedorPorId.get(a.proveedor_habitual_id) ?? ''
          : ''
        : a[col]
    return [...base].sort((a, b) => signo * comparar(valor(a, columna), valor(b, columna)))
  }, [articulos, busqueda, proveedorFiltro, columna, direccion, nombreProveedorPorId])

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o código interno..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-64"
        />
        <select
          value={proveedorFiltro}
          onChange={(e) => setProveedorFiltro(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos los proveedores</option>
          <option value={SIN_PROVEEDOR_HABITUAL}>Sin proveedor habitual</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>{p.razon_social}</option>
          ))}
        </select>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th
                className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700"
                onClick={() => ordenarPor('codigo_interno')}
              >
                Código{indicador('codigo_interno')}
              </th>
              <th
                className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700"
                onClick={() => ordenarPor('nombre')}
              >
                Nombre{indicador('nombre')}
              </th>
              <th
                className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700"
                onClick={() => ordenarPor('categoria')}
              >
                Categoría{indicador('categoria')}
              </th>
              <th
                className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700"
                onClick={() => ordenarPor('unidad')}
              >
                Unidad{indicador('unidad')}
              </th>
              <th
                className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700"
                onClick={() => ordenarPor('proveedor_habitual')}
              >
                Proveedor habitual{indicador('proveedor_habitual')}
              </th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr key={a.id} className={`border-b border-slate-100 last:border-0 ${!a.activo ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-slate-600">{a.codigo_interno}</td>
                <td className="px-4 py-3 text-slate-800">
                  <Link href={`/articulos/${a.id}`} className="text-teal-600 hover:underline">
                    {a.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{a.categoria ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{a.unidad ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{nombreProveedorHabitual(a) || '-'}</td>
                <td className="px-4 py-3">
                  <ArticuloEstadoBoton id={a.id} activo={a.activo} />
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onEditar(a)} className="text-teal-600 hover:underline text-sm">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay artículos que coincidan.</p>
      )}
    </div>
  )
}
