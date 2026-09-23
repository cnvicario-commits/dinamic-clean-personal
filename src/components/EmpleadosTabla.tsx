import Link from 'next/link'
import EmpleadoEstadoBoton from './EmpleadoEstadoBoton'
import type { EmployeeListItem } from '@/lib/api/generated'

type Props = {
  empleados: EmployeeListItem[]
  clientes: { id: string; nombre: string }[]
  page: number
  pageSize: number
  total: number
  filters: { search?: string; activo?: string; clienteId?: string }
}

export default function EmpleadosTabla({ empleados, clientes, page, pageSize, total, filters }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const pageHref = (nextPage: number) => {
    const query = new URLSearchParams()
    if (filters.search) query.set('search', filters.search)
    if (filters.activo) query.set('activo', filters.activo)
    if (filters.clienteId) query.set('clienteId', filters.clienteId)
    query.set('page', String(nextPage))
    return `/empleados?${query.toString()}`
  }

  return (
    <div className="mt-8">
      <form method="get" className="flex flex-wrap gap-3 mb-4">
        <input name="search" type="search" defaultValue={filters.search ?? ''} placeholder="Buscar por nombre..." className="border border-slate-300 rounded-md px-3 py-2 text-sm w-64" />
        <select name="activo" defaultValue={filters.activo ?? ''} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option>
        </select>
        <select name="clienteId" defaultValue={filters.clienteId ?? ''} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">Todas las asignaciones</option>
          {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
        </select>
        <button className="px-4 py-2 bg-slate-700 text-white text-sm rounded-md">Filtrar</button>
      </form>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Listado ({total})</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
            <th className="px-4 py-3 font-medium">Nombre y apellido</th><th className="px-4 py-3 font-medium">CUIL</th>
            <th className="px-4 py-3 font-medium">Fecha de ingreso</th><th className="px-4 py-3 font-medium">Contrato</th>
            <th className="px-4 py-3 font-medium">Asignación</th><th className="px-4 py-3 font-medium">Estado</th>
          </tr></thead>
          <tbody>{empleados.map((employee) => {
            const activeAssignments = employee.asignaciones.filter((assignment) => !assignment.fecha_hasta)
            return <tr key={employee.id} className={`border-b border-slate-100 last:border-0 ${!employee.activo ? 'opacity-50' : ''}`}>
              <td className="px-4 py-3 text-slate-800">{employee.nombre_apellido}</td><td className="px-4 py-3 text-slate-600">{employee.cuil}</td>
              <td className="px-4 py-3 text-slate-600">{employee.fecha_ingreso ?? '-'}</td><td className="px-4 py-3">{employee.horas_contrato} hs</td>
              <td className="px-4 py-3 text-slate-600">{activeAssignments.map((a) => a.clientes?.nombre).filter(Boolean).join(', ') || <span className="text-slate-400 italic">Sin asignar</span>}</td>
              <td className="px-4 py-3"><EmpleadoEstadoBoton id={employee.id} activo={employee.activo} /></td>
            </tr>
          })}</tbody>
        </table>
      </div>
      {empleados.length === 0 && <p className="text-slate-500 text-sm mt-3">No hay empleados que coincidan.</p>}
      {pages > 1 && <div className="flex items-center justify-end gap-3 mt-4 text-sm">
        {page > 1 ? <Link className="text-teal-700" href={pageHref(page - 1)}>Anterior</Link> : <span className="text-slate-400">Anterior</span>}
        <span>Página {page} de {pages}</span>
        {page < pages ? <Link className="text-teal-700" href={pageHref(page + 1)}>Siguiente</Link> : <span className="text-slate-400">Siguiente</span>}
      </div>}
    </div>
  )
}
