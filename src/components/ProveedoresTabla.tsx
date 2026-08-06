'use client'

import { useState, useMemo } from 'react'
import ProveedorEstadoBoton from './ProveedorEstadoBoton'

type Proveedor = {
  id: string
  razon_social: string
  cuit: string
  domicilio: string | null
  telefono: string | null
  activo: boolean
}

export default function ProveedoresTabla({
  proveedores,
  onEditar,
}: {
  proveedores: Proveedor[]
  onEditar: (p: Proveedor) => void
}) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (q === '') return proveedores
    return proveedores.filter(
      (p) => p.razon_social.toLowerCase().includes(q) || p.cuit.toLowerCase().includes(q)
    )
  }, [proveedores, busqueda])

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por razón social o CUIT..."
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
              <th className="px-4 py-3 font-medium">Razón social</th>
              <th className="px-4 py-3 font-medium">CUIT</th>
              <th className="px-4 py-3 font-medium">Domicilio</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${!p.activo ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-slate-800">{p.razon_social}</td>
                <td className="px-4 py-3 text-slate-600">{p.cuit}</td>
                <td className="px-4 py-3 text-slate-600">{p.domicilio ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{p.telefono ?? '-'}</td>
                <td className="px-4 py-3">
                  <ProveedorEstadoBoton id={p.id} activo={p.activo} />
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onEditar(p)} className="text-teal-600 hover:underline text-sm">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay proveedores que coincidan.</p>
      )}
    </div>
  )
}
