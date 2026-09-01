import { createClient } from '@/utils/supabase/server'
import ClienteForm from '@/components/ClienteForm'
import ClientesTabla from '@/components/ClientesTabla'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, domicilio, presupuesto_4hs, presupuesto_8hs, lleva_insumos, codigo_costos, cuit')
    .order('nombre')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Clientes</h1>

      <ClienteForm />

      <div className="mt-8">
        <ClientesTabla clientes={clientes ?? []} />
      </div>
    </div>
  )
}
