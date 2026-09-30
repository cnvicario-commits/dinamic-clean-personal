import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import SeguimientoPlanesAccion from '@/components/SeguimientoPlanesAccion'
import CrmPagination from '@/components/CrmPagination'
import type { AuditAction } from '@/lib/api/generated'

export default async function SeguimientoPlanesAccionPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    estado?: string
    responsableId?: string
    vencidos?: string
    q?: string
  }>
}) {
  const sp = await searchParams
  const requestedPage = Number(sp.page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const estado = (sp.estado || undefined) as AuditAction['estado'] | undefined
  const responsableId = sp.responsableId || undefined
  const vencidos = sp.vencidos === 'true' ? true : undefined
  const q = sp.q || undefined

  const api = await createAuthenticatedServerApiClient()
  const [result, catalogs] = await Promise.all([
    api.listAuditActions({
      page,
      pageSize: 50,
      ...(estado ? { estado } : {}),
      ...(responsableId ? { responsableId } : {}),
      ...(vencidos ? { vencidos } : {}),
      ...(q ? { q } : {}),
    }),
    api.getAuditCatalogs(),
  ])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Seguimiento de planes de acción</h1>
      <SeguimientoPlanesAccion
        planes={result.items}
        responsables={catalogs.supervisores}
        total={result.total}
        filters={{
          estado: estado ?? '',
          responsableId: responsableId ?? '',
          vencidos: Boolean(vencidos),
          q: q ?? '',
        }}
      />
      <CrmPagination
        path="/auditorias/seguimiento"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        query={{
          estado,
          responsableId,
          vencidos: vencidos ? 'true' : undefined,
          q,
        }}
      />
    </div>
  )
}
