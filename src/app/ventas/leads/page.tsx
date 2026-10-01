import { createClient } from '@/utils/supabase/server'
import TableroLeads from '@/components/TableroLeads'
import type { LeadVista } from '@/types/crm'

export default async function LeadsPage() {
  const supabase = await createClient()

  const [{ data: leads }, { data: responsables }] = await Promise.all([
    supabase
      .from('crm_leads')
      .select('*, crm_prospectos(id, nombre, tipo_cliente_id, contacto_nombre, telefono), perfiles(nombre_completo)')
      .order('created_at', { ascending: false }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Leads</h1>
      <p className="text-sm text-slate-500 mb-6">
        Seguimiento de potenciales clientes antes de que haya algo concreto para cotizar. Cuando se concreta, se convierte en Oportunidad.
      </p>
      <TableroLeads leads={(leads ?? []) as unknown as LeadVista[]} responsables={responsables ?? []} />
    </div>
  )
}
