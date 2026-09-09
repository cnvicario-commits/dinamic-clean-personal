import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PlanificacionAuditoriaForm from '@/components/PlanificacionAuditoriaForm'
import type { PlanificacionEdicion } from '@/types/auditoria'

export default async function EditarPlanificacionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: planificacionRaw } = await supabase
    .from('auditoria_planificaciones')
    .select('*, cliente_domicilios(cliente_id, clientes(id, nombre))')
    .eq('id', id)
    .maybeSingle()
  const planificacion = planificacionRaw as unknown as PlanificacionEdicion | null

  if (!planificacion) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Planificación no encontrada.</p>
        <Link href="/auditorias/planificacion" className="text-teal-600 hover:underline text-sm">
          ← Volver a Planificación
        </Link>
      </div>
    )
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

  const [{ data: clientes }, { data: domicilios }, { data: supervisores }] = await Promise.all([
    supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('cliente_domicilios').select('id, cliente_id, alias, direccion, activo'),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
  ])

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Editar planificación</h1>
      <PlanificacionAuditoriaForm
        clientes={clientes ?? []}
        domicilios={domicilios ?? []}
        supervisores={supervisores ?? []}
        planificacion={planificacion}
      />
    </div>
  )
}
