import { createClient } from '@/utils/supabase/server'
import SeguimientoPlanesAccion from '@/components/SeguimientoPlanesAccion'
import type { PlanAccionSeguimiento } from '@/types/auditoria'

export default async function SeguimientoPlanesAccionPage() {
  const supabase = await createClient()

  const [{ data: planes }, { data: responsables }] = await Promise.all([
    supabase
      .from('auditoria_plan_accion')
      .select(
        '*, perfiles(nombre_completo), auditorias(fecha_realizada, cliente_domicilios(alias, clientes(nombre))), auditoria_respuestas(auditoria_checklist_items(texto))'
      )
      .order('fecha_limite', { ascending: true }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
  ])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Seguimiento de planes de acción</h1>
      <SeguimientoPlanesAccion
        planes={(planes ?? []) as unknown as PlanAccionSeguimiento[]}
        responsables={responsables ?? []}
      />
    </div>
  )
}
