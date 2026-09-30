import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import PlanificacionesTabla from '@/components/PlanificacionesTabla'
import CrmPagination from '@/components/CrmPagination'
import type { AuditPlanning } from '@/lib/api/generated'

export default async function PlanificacionAuditoriasPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    estado?: string
    supervisorId?: string
  }>
}) {
  const sp = await searchParams
  const requestedPage = Number(sp.page ?? '1')
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const estado = (sp.estado || undefined) as AuditPlanning['estado'] | undefined
  const supervisorId = sp.supervisorId || undefined

  const api = await createAuthenticatedServerApiClient()
  const [result, catalogs] = await Promise.all([
    api.listAuditPlannings({
      page,
      pageSize: 50,
      ...(estado ? { estado } : {}),
      ...(supervisorId ? { supervisorId } : {}),
    }),
    api.getAuditCatalogs(),
  ])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Planificación de auditorías</h1>
        <Link
          href="/auditorias/planificacion/nueva"
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Planificar auditoría
        </Link>
      </div>
      <PlanificacionesTabla
        planificaciones={result.items}
        supervisores={catalogs.supervisores}
        total={result.total}
        filters={{
          estado: estado ?? '',
          supervisorId: supervisorId ?? '',
        }}
      />
      <CrmPagination
        path="/auditorias/planificacion"
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        query={{ estado, supervisorId }}
      />
    </div>
  )
}
