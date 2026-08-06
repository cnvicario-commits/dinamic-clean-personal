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

export default function ArticulosTabla({
  articulos,
  onEditar,
}: {
  articulos: Articulo[]
  onEditar: (a: Articulo) => void
}) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q === '') return articulos
    return articulos.filter(
      (a) => a.nombre.toLowerCase().includes(q) || a.codigo_interno.toLowerCase().includes(q)
    )
  }, [articulos, busqueda])

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
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
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
