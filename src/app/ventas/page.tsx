import { createClient } from '@/utils/supabase/server'
import TableroVentas from '@/components/TableroVentas'
import type { OportunidadVista } from '@/types/crm'

export default async function VentasPage() {
  const supabase = await createClient()
  const [{ data: oportunidades }, { data: responsables }, { data: tiposCliente }] = await Promise.all([
    supabase
      .from('crm_oportunidades')
      .select(
        '*, crm_prospectos(id, nombre, tipo_cliente_id), crm_tipos_servicio(nombre), perfiles(nombre_completo)'
      )
      .order('created_at', { ascending: false }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
    supabase.from('crm_tipos_cliente').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Ventas</h1>
      <TableroVentas
        oportunidades={(oportunidades ?? []) as unknown as OportunidadVista[]}
        responsables={responsables ?? []}
        tiposCliente={tiposCliente ?? []}
      />
    </div>
  )
}
