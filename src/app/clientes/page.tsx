import { createClient } from '@/utils/supabase/server'
import ClienteForm from '@/components/ClienteForm'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .order('nombre')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Clientes</h1>

      <ClienteForm />

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Listado ({clientes?.length ?? 0})
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Presup. 4hs</th>
                <th className="px-4 py-3 font-medium">Presup. 8hs</th>
              </tr>
            </thead>
            <tbody>
              {clientes?.map((cliente) => (
                <tr key={cliente.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{cliente.nombre}</td>
                  <td className="px-4 py-3 text-slate-600">{cliente.presupuesto_4hs}</td>
                  <td className="px-4 py-3 text-slate-600">{cliente.presupuesto_8hs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clientes?.length === 0 && (
          <p className="text-slate-500 text-sm mt-3">No hay clientes cargados todavía.</p>
        )}
      </div>
    </div>
  )
}