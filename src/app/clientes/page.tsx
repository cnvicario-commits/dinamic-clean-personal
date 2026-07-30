import { createClient } from '@/utils/supabase/server'
import ClienteForm from '@/components/ClienteForm'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .order('nombre')

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Clientes</h1>

      <ClienteForm />

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Listado ({clientes?.length ?? 0})
        </h2>
        <ul className="space-y-2">
          {clientes?.map((cliente) => (
            <li
              key={cliente.id}
              className="px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm"
            >
              {cliente.nombre}
            </li>
          ))}
        </ul>
        {clientes?.length === 0 && (
          <p className="text-slate-500 text-sm">No hay clientes cargados todavía.</p>
        )}
      </div>
    </div>
  )
}