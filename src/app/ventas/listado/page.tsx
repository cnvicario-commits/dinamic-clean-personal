import { createClient } from '@/utils/supabase/server'
import ListadoOportunidadesTabla from '@/components/ListadoOportunidadesTabla'
import type { OportunidadListado } from '@/types/crm'

export default async function ListadoVentasPage() {
  const supabase = await createClient()

  const [{ data: oportunidades }, { data: responsables }, { data: tiposCliente }] = await Promise.all([
    supabase
      .from('crm_oportunidades')
      .select(
        '*, crm_prospectos(id, nombre, tipo_cliente_id, contacto_nombre, telefono, email, referido_por_id, crm_tipos_cliente(nombre), crm_referidores(nombre)), crm_tipos_servicio(nombre), perfiles(nombre_completo)'
      )
      .order('fecha_ingreso', { ascending: false }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
    supabase.from('crm_tipos_cliente').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Listado de oportunidades</h1>
      <ListadoOportunidadesTabla
        oportunidades={(oportunidades ?? []) as unknown as OportunidadListado[]}
        responsables={responsables ?? []}
        tiposCliente={tiposCliente ?? []}
      />
    </div>
  )
}
