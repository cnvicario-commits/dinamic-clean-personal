import { createClient } from '@/utils/supabase/server'
import AuditoriaDashboard from '@/components/AuditoriaDashboard'
import type { RespuestaDashboard, AuditoriaResumen, PlanificacionResumen, PlanAccionResumen } from '@/types/auditoria'

export default async function AuditoriasDashboardPage() {
  const supabase = await createClient()

  const [{ data: respuestas }, { data: auditorias }, { data: planificaciones }, { data: planesAccion }] =
    await Promise.all([
      supabase.from('auditoria_respuestas').select('auditoria_id, resultado, auditoria_checklist_items(texto)'),
      supabase
        .from('auditorias')
        .select('id, fecha_realizada, quejas_comentarios_cliente, cliente_domicilios(alias, clientes(nombre)), perfiles(nombre_completo)'),
      supabase.from('auditoria_planificaciones').select('estado, fecha_propuesta'),
      supabase.from('auditoria_plan_accion').select('estado, fecha_limite'),
    ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Auditoría y Calidad — Dashboard</h1>
      <AuditoriaDashboard
        respuestas={(respuestas ?? []) as unknown as RespuestaDashboard[]}
        auditorias={(auditorias ?? []) as unknown as AuditoriaResumen[]}
        planificaciones={(planificaciones ?? []) as PlanificacionResumen[]}
        planesAccion={(planesAccion ?? []) as PlanAccionResumen[]}
      />
    </div>
  )
}
