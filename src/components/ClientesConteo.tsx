'use client'

import { useState } from 'react'

type ClienteConteo = { nombre: string; cantidad: number }

export default function ClientesConteo({ datos }: { datos: ClienteConteo[] }) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = datos.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <input
        type="text"
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full px-3 py-2 mb-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {filtrados.map((c, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-slate-800">{c.nombre}</td>
                <td className="px-4 py-2 text-right font-medium text-slate-700">{c.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <p className="text-slate-500 text-sm p-4">
            {datos.length === 0 ? 'No hay asignaciones activas todavía.' : 'Sin resultados para esa búsqueda.'}
          </p>
        )}
      </div>
    </div>
  )
}