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
}

type Columna = 'codigo_interno' | 'nombre' | 'categoria' | 'unidad'

// Comparación alfabética sin distinguir mayúsculas/minúsculas ni acentos,
// para que un nombre cargado en minúscula (ej: "pinza") no quede aislado
// al final de la lista por una comparación sensible a mayúsculas.
function comparar(a: string | null, b: string | null) {
  return (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'base' })
}

export default function ArticulosTabla({
  articulos,
  onEditar,
}: {
  articulos: Articulo[]
  onEditar: (a: Articulo) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [columna, setColumna] = useState<Columna>('nombre')
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
      ? articulos
      : articulos.filter(
          (a) => a.nombre.toLowerCase().includes(q) || a.codigo_interno.toLowerCase().includes(q)
        )
    const signo = direccion === 'asc' ? 1 : -1
    return [...base].sort((a, b) => signo * comparar(a[columna], b[columna]))
  }, [articulos, busqueda, columna, direccion])

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
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
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
