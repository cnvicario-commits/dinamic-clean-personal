import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import { ApiClientError } from '@/lib/api/generated'
import AdministracionChecklist from '@/components/AdministracionChecklist'

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ plantilla?: string }>
}) {
  const { plantilla: plantillaIdParam } = await searchParams
  const api = await createAuthenticatedServerApiClient()

  const plantillas = await api.listAuditChecklists()
  const activa = plantillas.find((p) => p.activa) ?? null
  const seleccionadaMeta = plantillas.find((p) => p.id === plantillaIdParam) ?? activa ?? plantillas[0] ?? null

  let seleccionada = null
  if (seleccionadaMeta) {
    try {
      seleccionada = await api.getAuditChecklist(seleccionadaMeta.id)
    } catch (err) {
      if (!(err instanceof ApiClientError && err.status === 404)) throw err
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Administración del checklist</h1>
      <p className="text-sm text-slate-500 mb-6">
        Checklist usado para las auditorías de calidad en los sitios de cliente. Solo una versión puede estar
        activa a la vez — es la que se toma automáticamente al cargar una auditoría nueva.
      </p>
      <AdministracionChecklist
        plantillas={plantillas}
        plantillaSeleccionada={seleccionada}
        items={seleccionada?.items ?? []}
      />
    </div>
  )
}
