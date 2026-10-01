import { createClient } from '@/utils/supabase/server'
import AgendaVentas from '@/components/AgendaVentas'
import { nombreResponsable, type ItemAgenda, type OportunidadVista, type LeadVista } from '@/types/crm'

function formatearMonto(valor: number | null): string {
  if (valor === null) return ''
  return `$ ${valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

export default async function AgendaVentasPage() {
  const supabase = await createClient()

  // Solo las oportunidades activamente en seguimiento: aceptado/rechazado/en_espera
  // ya están cerradas para el día a día (no tiene sentido agendarlas). Mismo
  // criterio para leads: por_contactar/en_conversacion están activos,
  // convertido/sin_interes ya están cerrados.
  const [{ data: oportunidades }, { data: leads }, { data: responsables }] = await Promise.all([
    supabase
      .from('crm_oportunidades')
      .select(
        '*, crm_prospectos(id, nombre, tipo_cliente_id), crm_tipos_servicio(nombre), perfiles(nombre_completo)'
      )
      .eq('estado', 'en_seguimiento')
      .order('proxima_fecha_seguimiento', { ascending: true, nullsFirst: false }),
    supabase
      .from('crm_leads')
      .select('*, crm_prospectos(id, nombre, contacto_nombre), perfiles(nombre_completo)')
      .in('estado', ['por_contactar', 'en_conversacion'])
      .order('proxima_fecha_contacto', { ascending: true, nullsFirst: false }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
  ])

  const itemsOportunidades: ItemAgenda[] = ((oportunidades ?? []) as unknown as OportunidadVista[]).map((o) => ({
    id: o.id,
    tipo: 'oportunidad',
    href: `/ventas/${o.id}`,
    cliente: o.crm_prospectos?.nombre ?? '-',
    subtitulo: o.crm_tipos_servicio?.nombre ?? 'Sin tipo de servicio',
    fecha: o.proxima_fecha_seguimiento,
    responsableId: o.responsable_id,
    responsableNombre: nombreResponsable(o),
    montoTexto: formatearMonto(o.monto_estimado),
  }))

  const itemsLeads: ItemAgenda[] = ((leads ?? []) as unknown as LeadVista[]).map((l) => ({
    id: l.id,
    tipo: 'lead',
    href: `/ventas/leads/${l.id}`,
    cliente: l.crm_prospectos?.nombre ?? '-',
    subtitulo: l.crm_prospectos?.contacto_nombre ?? 'Sin contacto',
    fecha: l.proxima_fecha_contacto,
    responsableId: l.responsable_id,
    responsableNombre: l.perfiles?.nombre_completo ?? '-',
    montoTexto: null,
  }))

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Agenda de ventas</h1>
      <AgendaVentas items={[...itemsOportunidades, ...itemsLeads]} responsables={responsables ?? []} />
    </div>
  )
}
