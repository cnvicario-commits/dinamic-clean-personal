import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import ListadoAuditoriasTabla from '@/components/ListadoAuditoriasTabla'
import CrmPagination from '@/components/CrmPagination'

export default async function ListadoAuditoriasPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    supervisorId?: string
    desde?: string
    hasta?: string
    q?: string
  }>
}) {
  const sp = await searchParams
  const requestedPage = Number(sp.page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const supervisorId = sp.supervisorId || undefined
  const desde = sp.desde || undefined
  const hasta = sp.hasta || undefined
  const q = sp.q?.trim() || undefined

  const api = await createAuthenticatedServerApiClient()
  const [result, catalogs] = await Promise.all([
    api.listAudits({
      page,
      pageSize: 50,
      ...(supervisorId ? { supervisorId } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
      ...(q ? { q } : {}),
    }),
    api.getAuditCatalogs(),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Auditorías realizadas</h1>
      <ListadoAuditoriasTabla
        auditorias={result.items}
        supervisores={catalogs.supervisores}
        total={result.total}
        filters={{
          supervisorId: supervisorId ?? '',
          desde: desde ?? '',
          hasta: hasta ?? '',
          q: q ?? '',
        }}
      />
      <CrmPagination
        path="/auditorias/listado"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        query={{ supervisorId, desde, hasta, q }}
      />
    </div>
  )
}
