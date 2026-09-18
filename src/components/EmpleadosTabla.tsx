'use client'

import { useState, useMemo } from 'react'
import EmpleadoEstadoBoton from './EmpleadoEstadoBoton'
import type { EmployeeAssignment, EmployeeListItem } from '@/lib/api/generated'

type Cliente = {
  id: string
  nombre: string
}

function asignacionesActivas(asignaciones: EmployeeAssignment[]) {
  const activas = asignaciones?.filter((a) => !a.fecha_hasta) ?? []
  return activas.sort(
    (a, b) => new Date(b.fecha_desde).getTime() - new Date(a.fecha_desde).getTime()
  )
}

export default function EmpleadosTabla({
  empleados,
  clientes,
}: {
  empleados: EmployeeListItem[]
  clientes: Cliente[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState('')

  const filtrados = useMemo(() => {
    return empleados.filter((emp) => {
      const coincideNombre = emp.nombre_apellido
        .toLowerCase()
        .includes(busqueda.toLowerCase())

      const activas = asignacionesActivas(emp.asignaciones)
      const coincideCliente =
        clienteFiltro === '' || activas.some((a) => a.clientes?.id === clienteFiltro)

      return coincideNombre && coincideCliente
    })
  }, [empleados, busqueda, clienteFiltro])

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-64"
        />
        <select
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todas las asignaciones</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Nombre y apellido</th>
              <th className="px-4 py-3 font-medium">CUIL</th>
              <th className="px-4 py-3 font-medium">Fecha de ingreso</th>
              <th className="px-4 py-3 font-medium">Contrato</th>
              <th className="px-4 py-3 font-medium">Asignación</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((emp) => {
              const activas = asignacionesActivas(emp.asignaciones)
              return (
                <tr
                  key={emp.id}
                  className={`border-b border-slate-100 last:border-0 ${
                    !emp.activo ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-slate-800">{emp.nombre_apellido}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.cuil}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.fecha_ingreso ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {emp.horas_contrato === 1 ? '4+4 hs' : `${emp.horas_contrato} hs`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {activas.length > 0 ? (
                      activas.map((a) => a.clientes?.nombre).filter(Boolean).join(', ')
                    ) : (
                      <span className="text-slate-400 italic">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <EmpleadoEstadoBoton id={emp.id} activo={emp.activo} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay empleados que coincidan.</p>
      )}
    </div>
  )
}