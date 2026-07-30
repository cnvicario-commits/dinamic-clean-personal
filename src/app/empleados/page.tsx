import { createClient } from '@/utils/supabase/server'
import EmpleadoForm from '@/components/EmpleadoForm'

export default async function EmpleadosPage() {
  const supabase = await createClient()
  const { data: empleados } = await supabase
    .from('empleados')
    .select('*')
    .order('nombre_apellido')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Empleados</h1>

      <EmpleadoForm />

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Listado ({empleados?.length ?? 0})
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3 font-medium">Nombre y apellido</th>
                <th className="px-4 py-3 font-medium">CUIL</th>
                <th className="px-4 py-3 font-medium">Fecha de ingreso</th>
                <th className="px-4 py-3 font-medium">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {empleados?.map((emp) => (
                <tr key={emp.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{emp.nombre_apellido}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.cuil}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.fecha_ingreso ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {emp.horas_contrato} hs
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {empleados?.length === 0 && (
          <p className="text-slate-500 text-sm mt-3">No hay empleados cargados todavía.</p>
        )}
      </div>
    </div>
  )
}