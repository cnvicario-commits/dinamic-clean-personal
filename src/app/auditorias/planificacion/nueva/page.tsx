import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import PlanificacionAuditoriaForm from '@/components/PlanificacionAuditoriaForm'

export default async function NuevaPlanificacionPage() {
  const api = await createAuthenticatedServerApiClient()
  const catalogs = await api.getAuditCatalogs()

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Planificar auditoría</h1>
      <PlanificacionAuditoriaForm
        clientes={catalogs.clientes}
        domicilios={catalogs.domicilios}
        supervisores={catalogs.supervisores}
      />
    </div>
  )
}
