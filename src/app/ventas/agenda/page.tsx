import { createClient } from '@/utils/supabase/server'
import AgendaVentas from '@/components/AgendaVentas'
import type { OportunidadVista } from '@/types/crm'

export default async function AgendaVentasPage() {
  const supabase = await createClient()

  // Solo las oportunidades activamente en seguimiento: aceptado/rechazado/en_espera
  // ya están cerradas para el día a día (no tiene sentido agendarlas).
  const [{ data: oportunidades }, { data: responsables }] = await Promise.all([
    supabase
      .from('crm_oportunidades')
      .select(
        '*, crm_prospectos(id, nombre, tipo_cliente_id), crm_tipos_servicio(nombre), perfiles(nombre_completo)'
      )
      .eq('estado', 'en_seguimiento')
      .order('proxima_fecha_seguimiento', { ascending: true, nullsFirst: false }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Agenda de ventas</h1>
      <AgendaVentas
        oportunidades={(oportunidades ?? []) as unknown as OportunidadVista[]}
        responsables={responsables ?? []}
      />
    </div>
  )
}
