import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import AuditoriaDashboard from '@/components/AuditoriaDashboard'

export default async function AuditoriasDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const { desde, hasta } = await searchParams
  const api = await createAuthenticatedServerApiClient()
  const dashboard = await api.getAuditDashboard({
    ...(desde ? { desde } : {}),
    ...(hasta ? { hasta } : {}),
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Auditoría y Calidad — Dashboard</h1>
      <AuditoriaDashboard dashboard={dashboard} desde={desde ?? ''} hasta={hasta ?? ''} />
    </div>
  )
}
