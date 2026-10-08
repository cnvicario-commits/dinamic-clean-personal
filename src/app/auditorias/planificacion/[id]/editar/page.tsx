import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import { ApiClientError } from '@/lib/api/generated'
import PlanificacionAuditoriaForm from '@/components/PlanificacionAuditoriaForm'

export default async function EditarPlanificacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const api = await createAuthenticatedServerApiClient()

  let planificacion
  try {
    planificacion = await api.getAuditPlanning(id)
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) {
      return (
        <div className="max-w-2xl mx-auto px-6 py-10">
          <p className="text-slate-500 mb-4">Planificación no encontrada.</p>
          <Link href="/auditorias/planificacion" className="text-teal-600 hover:underline text-sm">
            ← Volver a Planificación
          </Link>
        </div>
      )
    }
    throw err
  }

  // Solo se puede editar mientras siga en 'planificada' — una vez cargada la
  // auditoría (estado 'realizada') o cancelada, los datos de planificación
  // ya no se tocan (mismo criterio que "Cargar auditoría" / "Cancelar" en
  // PlanificacionesTabla, que también se ocultan fuera de 'planificada').
  if (planificacion.estado !== 'planificada') {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">
          Esta planificación ya no está en estado &quot;planificada&quot; y no se puede editar.
        </p>
        <Link href="/auditorias/planificacion" className="text-teal-600 hover:underline text-sm">
          ← Volver a Planificación
        </Link>
      </div>
    )
  }

  const catalogs = await api.getAuditCatalogs()

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Editar planificación</h1>
      <PlanificacionAuditoriaForm
        clientes={catalogs.clientes}
        domicilios={catalogs.domicilios}
        supervisores={catalogs.supervisores}
        planificacion={planificacion}
      />
    </div>
  )
}
