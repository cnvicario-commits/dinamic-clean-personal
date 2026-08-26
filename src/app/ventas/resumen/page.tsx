import { createClient } from '@/utils/supabase/server'
import ResumenEjecutivoVentas from '@/components/ResumenEjecutivoVentas'
import type { OportunidadResumen } from '@/types/crm'

export default async function ResumenVentasPage() {
  const supabase = await createClient()

  const [{ data: oportunidades }, { data: responsables }, { data: tiposCliente }] = await Promise.all([
    supabase
      .from('crm_oportunidades')
      .select(
        'id, estado, fecha_ingreso, monto_estimado, comision_monto, comision_liquidada, responsable_id, responsable_nombre_libre, crm_prospectos(tipo_cliente_id, crm_tipos_cliente(nombre), crm_referidores(nombre)), perfiles(nombre_completo)'
      )
      .order('fecha_ingreso', { ascending: false }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
    supabase.from('crm_tipos_cliente').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6 print:mb-4">Resumen ejecutivo de ventas</h1>
      <ResumenEjecutivoVentas
        oportunidades={(oportunidades ?? []) as unknown as OportunidadResumen[]}
        responsables={responsables ?? []}
        tiposCliente={tiposCliente ?? []}
      />
    </div>
  )
}
