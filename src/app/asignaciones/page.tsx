import { createClient } from '@/utils/supabase/server'
import AsignacionForm from '@/components/AsignacionForm'
import CerrarAsignacionBoton from '@/components/CerrarAsignacionBoton'

export default async function AsignacionesPage() {
  const supabase = await createClient()
  const { data: empleados } = await supabase.from('empleados').select('id, nombre_apellido').order('nombre_apellido')
  const { data: clientes } = await supabase.from('clientes').select('id, nombre').order('nombre')
  const { data: asignaciones } = await supabase.from('asignaciones').select('id, fecha_desde, fecha_hasta, empleados(nombre_apellido), clientes(nombre)').order('fecha_desde', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Asignaciones</h1>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 mb-8">
        <AsignacionForm empleados={empleados || []} clientes={clientes || []} />
      </div>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Listado ({asignaciones?.length ?? 0})</h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Empleado</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Desde</th>
              <th className="px-4 py-3 font-medium">Hasta</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {asignaciones?.map((a: any) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">{a.empleados?.nombre_apellido}</td>
                <td className="px-4 py-3 text-slate-800">{a.clientes?.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{a.fecha_desde}</td>
                <td className="px-4 py-3 text-slate-600">{a.fecha_hasta ?? 'Actual'}</td>
                <td className="px-4 py-3">
                  {!a.fecha_hasta && <CerrarAsignacionBoton id={a.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {asignaciones?.length === 0 && <p className="text-slate-500 text-sm mt-3">No hay asignaciones cargadas todavía.</p>}
    </div>
  )
}