import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import { ApiClientError } from '@/lib/api/generated'
import PlanAccionPanel from '@/components/PlanAccionPanel'
import type { ResultadoRespuesta } from '@/types/auditoria'

function formatearFecha(fecha: string | null) {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

const ETIQUETAS_RESULTADO: Record<ResultadoRespuesta, string> = {
  conforme: 'Conforme',
  no_conforme: 'No conforme',
  no_aplica: 'No aplica',
}

const COLORES_RESULTADO: Record<ResultadoRespuesta, string> = {
  conforme: 'bg-emerald-100 text-emerald-700',
  no_conforme: 'bg-rose-100 text-rose-700',
  no_aplica: 'bg-slate-200 text-slate-600',
}

export default async function FichaAuditoriaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const api = await createAuthenticatedServerApiClient()

  let auditoria
  try {
    auditoria = await api.getAudit(id)
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) {
      return (
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-slate-500 mb-4">Auditoría no encontrada.</p>
          <Link href="/auditorias/planificacion" className="text-teal-600 hover:underline text-sm">
            ← Volver a Planificación
          </Link>
        </div>
      )
    }
    throw err
  }

  const catalogs = await api.getAuditCatalogs()
  const respuestas = [...auditoria.respuestas].sort(
    (a, b) => (a.auditoria_checklist_items?.orden ?? 0) - (b.auditoria_checklist_items?.orden ?? 0)
  )
  const planes = auditoria.planes_accion

  const opcionesNoConformes = respuestas
    .filter((r) => r.resultado === 'no_conforme')
    .map((r) => ({ respuestaId: r.id, texto: r.auditoria_checklist_items?.texto ?? '-' }))

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/auditorias/planificacion" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a Planificación
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">
        {auditoria.cliente_domicilios?.clientes?.nombre ?? '-'} — {auditoria.cliente_domicilios?.alias ?? '-'}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {auditoria.cliente_domicilios?.direccion ?? 'Sin domicilio cargado'} · Checklist{' '}
        {auditoria.auditoria_checklist_plantillas?.codigo_formulario} {auditoria.auditoria_checklist_plantillas?.version}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6">
        <div>
          <p className="text-xs text-slate-500">Fecha realizada</p>
          <p className="text-sm text-slate-800">{formatearFecha(auditoria.fecha_realizada)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Supervisor</p>
          <p className="text-sm text-slate-800">{auditoria.perfiles?.nombre_completo ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Próxima supervisión</p>
          <p className="text-sm text-slate-800">{formatearFecha(auditoria.proxima_supervision_fecha)}</p>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <p className="text-xs text-slate-500">Evaluación general</p>
          <p className="text-sm text-slate-800">{auditoria.evaluacion_general ?? '-'}</p>
        </div>
        {auditoria.quejas_comentarios_cliente && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-slate-500">Quejas / comentarios del cliente</p>
            <p className="text-sm text-slate-800">{auditoria.quejas_comentarios_cliente}</p>
          </div>
        )}
        {auditoria.otros && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-xs text-slate-500">Otros</p>
            <p className="text-sm text-slate-800">{auditoria.otros}</p>
          </div>
        )}
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Checklist ({respuestas.length} ítems)
      </h2>
      <div className="flex flex-col gap-2 mb-8">
        {respuestas.map((r) => (
          <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-800">{r.auditoria_checklist_items?.texto ?? '-'}</p>
              <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${COLORES_RESULTADO[r.resultado]}`}>
                {ETIQUETAS_RESULTADO[r.resultado]}
              </span>
            </div>
            {r.observaciones && <p className="text-xs text-slate-500 mt-1">{r.observaciones}</p>}
          </div>
        ))}
      </div>

      <PlanAccionPanel
        auditoriaId={auditoria.id}
        opcionesNoConformes={opcionesNoConformes}
        responsables={catalogs.supervisores}
        planes={planes}
      />
    </div>
  )
}
