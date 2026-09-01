import { createClient } from '@/utils/supabase/server'
import CargaAuditoriaForm from '@/components/CargaAuditoriaForm'
import type { ChecklistItem } from '@/types/auditoria'

export default async function NuevaAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ planificacion?: string }>
}) {
  const { planificacion: planificacionId } = await searchParams
  const supabase = await createClient()

  const [{ data: plantillaActiva }, { data: clientes }, { data: domicilios }, { data: supervisores }] =
    await Promise.all([
      supabase.from('auditoria_checklist_plantillas').select('*').eq('activa', true).maybeSingle(),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('cliente_domicilios').select('id, cliente_id, alias, direccion, activo'),
      supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
    ])

  const { data: items } = plantillaActiva
    ? await supabase
        .from('auditoria_checklist_items')
        .select('*')
        .eq('plantilla_id', plantillaActiva.id)
        .order('orden', { ascending: true })
    : { data: [] }

  // Si se llega desde "Cargar auditoría" de una planificación pendiente: el
  // sitio y el supervisor quedan fijos (son los de esa planificación), no
  // se eligen de nuevo acá.
  type PlanificacionCruda = {
    id: string
    alias_id: string
    supervisor_id: string
    cliente_domicilios: { alias: string; direccion: string | null; clientes: { nombre: string } | null } | null
    perfiles: { nombre_completo: string } | null
  }

  const { data: planificacionRaw } = planificacionId
    ? await supabase
        .from('auditoria_planificaciones')
        .select('id, alias_id, supervisor_id, cliente_domicilios(alias, direccion, clientes(nombre)), perfiles(nombre_completo)')
        .eq('id', planificacionId)
        .maybeSingle()
    : { data: null }
  const planificacion = planificacionRaw as unknown as PlanificacionCruda | null

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
          items={(items ?? []) as ChecklistItem[]}
          clientes={clientes ?? []}
          domicilios={domicilios ?? []}
          supervisores={supervisores ?? []}
          planificacion={
            planificacion
              ? {
                  id: planificacion.id,
                  aliasId: planificacion.alias_id,
                  supervisorId: planificacion.supervisor_id,
                  clienteNombre: planificacion.cliente_domicilios?.clientes?.nombre ?? '-',
                  sitioAlias: planificacion.cliente_domicilios?.alias ?? '-',
                  sitioDireccion: planificacion.cliente_domicilios?.direccion ?? null,
                  supervisorNombre: planificacion.perfiles?.nombre_completo ?? '-',
                }
              : null
          }
        />
      )}
    </div>
  )
}
