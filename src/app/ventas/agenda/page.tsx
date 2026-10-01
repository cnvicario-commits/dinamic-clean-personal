import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import AgendaVentas from '@/components/AgendaVentas'
import CrmPagination from '@/components/CrmPagination'

export default async function AgendaVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tipo?: string; responsableId?: string }>
}) {
  const query = await searchParams
  const requestedPage = Number(query.page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const tipo = query.tipo === 'oportunidad' || query.tipo === 'lead' ? query.tipo : undefined
  const api = await createAuthenticatedServerApiClient()
  const me = await api.getMe()
  const puedeFiltrarResponsable = me.role === 'admin' || me.role === 'gerente'
  const responsableId = puedeFiltrarResponsable ? query.responsableId : undefined
  const [agenda, catalogs] = await Promise.all([
    api.getCrmAgenda({ page, pageSize: 50, tipo, responsableId }),
    api.getCrmCatalogs(),
  ])
  const filtro = (nextTipo: string) => {
    const params = new URLSearchParams()
    if (nextTipo) params.set('tipo', nextTipo)
    if (query.responsableId && puedeFiltrarResponsable) params.set('responsableId', query.responsableId)
    const text = params.toString()
    return text ? `/ventas/agenda?${text}` : '/ventas/agenda'
  }

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
      <form className="flex flex-wrap gap-2 mb-5" action="/ventas/agenda">
        <input type="hidden" name="tipo" value={tipo ?? ''} />
        {puedeFiltrarResponsable && (
          <>
            <select name="responsableId" defaultValue={query.responsableId ?? ''} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
              <option value="">Todos los responsables</option>
              {catalogs.responsables.map((responsable) => (
                <option key={responsable.id} value={responsable.id}>{responsable.nombre_completo}</option>
              ))}
            </select>
            <button type="submit" className="rounded bg-teal-600 px-3 py-2 text-sm font-medium text-white">Filtrar</button>
          </>
        )}
        <Link href={filtro('')} className={`px-3 py-2 text-sm rounded-md ${!tipo ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}>Todo</Link>
        <Link href={filtro('oportunidad')} className={`px-3 py-2 text-sm rounded-md ${tipo === 'oportunidad' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}>Oportunidades</Link>
        <Link href={filtro('lead')} className={`px-3 py-2 text-sm rounded-md ${tipo === 'lead' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}>Leads</Link>
      </form>
      <AgendaVentas items={agenda.items} />
      <CrmPagination path="/ventas/agenda" page={agenda.page} pageSize={agenda.pageSize} total={agenda.total} query={{ tipo, responsableId }} />
    </div>
  )
}
