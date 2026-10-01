import { createClient } from '@/utils/supabase/server'
import ListadoLeadsTabla from '@/components/ListadoLeadsTabla'
import type { LeadListado } from '@/types/crm'

export default async function ListadoLeadsPage() {
  const supabase = await createClient()

  const [{ data: leads }, { data: responsables }, { data: tiposCliente }] = await Promise.all([
    supabase
      .from('crm_leads')
      .select(
        '*, crm_prospectos(id, nombre, tipo_cliente_id, contacto_nombre, telefono, email, referido_por_id, crm_tipos_cliente(nombre), crm_referidores(nombre)), perfiles(nombre_completo)'
      )
      .order('created_at', { ascending: false }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
    supabase.from('crm_tipos_cliente').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Listado de leads</h1>
      <ListadoLeadsTabla
        leads={(leads ?? []) as unknown as LeadListado[]}
        responsables={responsables ?? []}
        tiposCliente={tiposCliente ?? []}
      />
    </div>
  )
}
