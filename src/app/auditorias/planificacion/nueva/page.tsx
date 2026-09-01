import { createClient } from '@/utils/supabase/server'
import PlanificacionAuditoriaForm from '@/components/PlanificacionAuditoriaForm'

export default async function NuevaPlanificacionPage() {
  const supabase = await createClient()

  const [{ data: clientes }, { data: domicilios }, { data: supervisores }] = await Promise.all([
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('cliente_domicilios').select('id, cliente_id, alias, direccion, activo'),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
  ])

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Planificar auditoría</h1>
      <PlanificacionAuditoriaForm
        clientes={clientes ?? []}
        domicilios={domicilios ?? []}
        supervisores={supervisores ?? []}
      />
    </div>
  )
}
