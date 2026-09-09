import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PlanificacionesTabla from '@/components/PlanificacionesTabla'
import type { PlanificacionListado } from '@/types/auditoria'

export default async function PlanificacionAuditoriasPage() {
  const supabase = await createClient()

  const [{ data: planificaciones }, { data: supervisores }] = await Promise.all([
    supabase
      .from('auditoria_planificaciones')
      .select('*, cliente_domicilios(alias, direccion, clientes(nombre)), perfiles(nombre_completo)')
      // '*' ya trae horario y observaciones (columnas agregadas en
      // 0032_auditoria_planificacion_horario_observaciones.sql).
      .order('fecha_propuesta', { ascending: true }),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
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
        planificaciones={(planificaciones ?? []) as unknown as PlanificacionListado[]}
        supervisores={supervisores ?? []}
      />
    </div>
  )
}
