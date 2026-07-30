'use client'

import { useState } from 'react'

type Comparacion = {
  nombre: string
  presupuesto4: number
  presupuesto8: number
  real4: number
  real8: number
}

function Diferencia({ real, presupuesto }: { real: number; presupuesto: number }) {
  const diff = real - presupuesto
  if (diff === 0) {
    return <span className="text-slate-400">=</span>
  }
  if (diff > 0) {
    return <span className="text-amber-600 font-medium">+{diff}</span>
  }
  return <span className="text-rose-600 font-medium">{diff}</span>
}

export default function ClientesComparacion({ datos }: { datos: Comparacion[] }) {
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
        className="w-full max-w-sm px-3 py-2 mb-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium text-center">Presup. 4hs</th>
              <th className="px-4 py-3 font-medium text-center">Real 4hs</th>
              <th className="px-4 py-3 font-medium text-center">Dif.</th>
              <th className="px-4 py-3 font-medium text-center">Presup. 8hs</th>
              <th className="px-4 py-3 font-medium text-center">Real 8hs</th>
              <th className="px-4 py-3 font-medium text-center">Dif.</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-slate-800">{c.nombre}</td>
                <td className="px-4 py-2 text-center text-slate-600">{c.presupuesto4}</td>
                <td className="px-4 py-2 text-center text-slate-600">{c.real4}</td>
                <td className="px-4 py-2 text-center"><Diferencia real={c.real4} presupuesto={c.presupuesto4} /></td>
                <td className="px-4 py-2 text-center text-slate-600">{c.presupuesto8}</td>
                <td className="px-4 py-2 text-center text-slate-600">{c.real8}</td>
                <td className="px-4 py-2 text-center"><Diferencia real={c.real8} presupuesto={c.presupuesto8} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <p className="text-slate-500 text-sm p-4">
            {datos.length === 0 ? 'No hay clientes cargados todavía.' : 'Sin resultados para esa búsqueda.'}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-2">
        <span className="text-rose-600 font-medium">Negativo</span> = faltan empleados ·{' '}
        <span className="text-amber-600 font-medium">Positivo</span> = hay de más
      </p>
    </div>
  )
}