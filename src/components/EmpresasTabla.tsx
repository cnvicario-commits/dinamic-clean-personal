'use client'

import { useState, useMemo } from 'react'
import EmpresaEstadoBoton from './EmpresaEstadoBoton'
import type { Empresa } from '@/types/compras'

export default function EmpresasTabla({
  empresas,
  onEditar,
}: {
  empresas: Empresa[]
  onEditar: (e: Empresa) => void
}) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q === '') return empresas
    return empresas.filter(
      (e) => e.nombre.toLowerCase().includes(q) || e.cuit.toLowerCase().includes(q)
    )
  }, [empresas, busqueda])

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o CUIT..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-64"
        />
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">CUIT</th>
              <th className="px-4 py-3 font-medium">Domicilio</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((e) => (
              <tr key={e.id} className={`border-b border-slate-100 last:border-0 ${!e.activo ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-slate-800">{e.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{e.cuit}</td>
                <td className="px-4 py-3 text-slate-600">{e.domicilio ?? '-'}</td>
                <td className="px-4 py-3">
                  <EmpresaEstadoBoton id={e.id} activo={e.activo} />
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onEditar(e)} className="text-teal-600 hover:underline text-sm">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay empresas que coincidan.</p>
      )}
    </div>
  )
}
