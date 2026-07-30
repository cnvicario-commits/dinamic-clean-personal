import { createClient } from '@/utils/supabase/server'
import AusenciaForm from '@/components/AusenciaForm'

export default async function AusenciasPage() {
  const supabase = await createClient()

  const { data: empleados } = await supabase
    .from('empleados')
    .select('id, nombre_apellido')
    .order('nombre_apellido')

  const { data: ausencias } = await supabase
    .from('ausencias')
    .select('id, fecha, justificada, observaciones, archivo_url, empleados(nombre_apellido)')
    .order('fecha', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Ausencias</h1>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 mb-8">
        <AusenciaForm empleados={empleados || []} />
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({ausencias?.length ?? 0})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Empleado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Observaciones</th>
              <th className="px-4 py-3 font-medium">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {ausencias?.map((a: any) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">{a.empleados?.nombre_apellido}</td>
                <td className="px-4 py-3 text-slate-600">{a.fecha}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      a.justificada
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {a.justificada ? 'Justificada' : 'Injustificada'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{a.observaciones || '-'}</td>
                <td className="px-4 py-3">
                  {a.archivo_url ? (
                    <a href={a.archivo_url} target="_blank" className="text-teal-600 hover:underline">
                      Ver
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ausencias?.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay ausencias cargadas todavía.</p>
      )}
    </div>
  )
}