'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

type Cliente = {
  id: string
  nombre: string
  domicilio: string | null
  presupuesto_4hs: number
  presupuesto_8hs: number
  lleva_insumos: boolean | null
  codigo_costos: string | null
  cuit: string | null
}

export default function ClientesTabla({ clientes }: { clientes: Cliente[] }) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.domicilio ?? '').toLowerCase().includes(q) ||
        (c.codigo_costos ?? '').toLowerCase().includes(q) ||
        (c.cuit ?? '').toLowerCase().includes(q)
    )
  }, [clientes, busqueda])

  return (
    <div>
      <input
        type="text"
        placeholder="Buscar por nombre, domicilio, código de costos o CUIT..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full sm:w-96 mb-4 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        autoFocus
      />

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({filtrados.length}{filtrados.length !== clientes.length ? ` de ${clientes.length}` : ''})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Domicilio</th>
              <th className="px-4 py-3 font-medium">Presup. 4hs</th>
              <th className="px-4 py-3 font-medium">Presup. 8hs</th>
              <th className="px-4 py-3 font-medium">Insumos</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((cliente) => (
              <tr key={cliente.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  <Link href={`/clientes/${cliente.id}`} className="text-teal-600 hover:underline">
                    {cliente.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{cliente.domicilio ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{cliente.presupuesto_4hs}</td>
                <td className="px-4 py-3 text-slate-600">{cliente.presupuesto_8hs}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    cliente.lleva_insumos
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {cliente.lleva_insumos ? 'Sí' : 'No'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">
          {clientes.length === 0 ? 'No hay clientes cargados todavía.' : 'No hay clientes que coincidan con la búsqueda.'}
        </p>
      )}
    </div>
  )
}
