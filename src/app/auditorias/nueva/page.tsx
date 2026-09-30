import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import { ApiClientError } from '@/lib/api/generated'
import CargaAuditoriaForm from '@/components/CargaAuditoriaForm'

export default async function NuevaAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ planificacion?: string }>
}) {
  const { planificacion: planificacionId } = await searchParams
  const api = await createAuthenticatedServerApiClient()

  const catalogs = await api.getAuditCatalogs()

  let plantillaActiva = null
  try {
    plantillaActiva = await api.getActiveAuditChecklist()
  } catch (err) {
    if (!(err instanceof ApiClientError && err.status === 404)) throw err
  }

  // Si se llega desde "Cargar auditoría" de una planificación pendiente: el
  // sitio y el supervisor quedan fijos (son los de esa planificación), no
  // se eligen de nuevo acá.
  let planificacion: {
    id: string
    aliasId: string
    supervisorId: string
    clienteNombre: string
    sitioAlias: string
    sitioDireccion: string | null
    supervisorNombre: string
  } | null = null

  if (planificacionId) {
    try {
      const p = await api.getAuditPlanning(planificacionId)
      const domicilio = catalogs.domicilios.find((d) => d.id === p.alias_id)
      const supervisor = catalogs.supervisores.find((s) => s.id === p.supervisor_id)
      const cliente =
        catalogs.clientes.find((c) => c.id === domicilio?.cliente_id) ??
        p.cliente_domicilios?.clientes ??
        null
      planificacion = {
        id: p.id,
        aliasId: p.alias_id,
        supervisorId: p.supervisor_id,
        clienteNombre: cliente?.nombre ?? '-',
        sitioAlias: domicilio?.alias ?? '-',
        sitioDireccion: domicilio?.direccion ?? null,
        supervisorNombre: supervisor?.nombre_completo ?? '-',
      }
    } catch (err) {
      if (!(err instanceof ApiClientError && err.status === 404)) throw err
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Cargar auditoría realizada</h1>
      {plantillaActiva && (
        <p className="text-sm text-slate-500 mb-6">
          Checklist: {plantillaActiva.codigo_formulario} {plantillaActiva.version}
        </p>
      )}
      {!plantillaActiva ? (
        <p className="text-rose-600 text-sm">
          No hay ninguna versión del checklist activa. Andá a Auditoría y Calidad → Checklist y activá una versión
          antes de cargar una auditoría.
        </p>
      ) : (
        <CargaAuditoriaForm
          plantillaId={plantillaActiva.id}
          items={plantillaActiva.items}
          clientes={catalogs.clientes}
          domicilios={catalogs.domicilios}
          supervisores={catalogs.supervisores}
          planificacion={planificacion}
        />
      )}
    </div>
  )
}
