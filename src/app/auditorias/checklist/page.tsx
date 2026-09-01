import { createClient } from '@/utils/supabase/server'
import AdministracionChecklist from '@/components/AdministracionChecklist'
import type { ChecklistPlantilla, ChecklistItem } from '@/types/auditoria'

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ plantilla?: string }>
}) {
  const { plantilla: plantillaIdParam } = await searchParams
  const supabase = await createClient()

  const { data: plantillas } = await supabase
    .from('auditoria_checklist_plantillas')
    .select('*')
    .order('created_at', { ascending: false })

  const lista = (plantillas ?? []) as ChecklistPlantilla[]
  const activa = lista.find((p) => p.activa) ?? null
  const seleccionada = lista.find((p) => p.id === plantillaIdParam) ?? activa ?? lista[0] ?? null

  const { data: items } = seleccionada
    ? await supabase
        .from('auditoria_checklist_items')
        .select('*')
        .eq('plantilla_id', seleccionada.id)
        .order('orden', { ascending: true })
    : { data: [] }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Administración del checklist</h1>
      <p className="text-sm text-slate-500 mb-6">
        Checklist usado para las auditorías de calidad en los sitios de cliente. Solo una versión puede estar
        activa a la vez — es la que se toma automáticamente al cargar una auditoría nueva.
      </p>
      <AdministracionChecklist
        plantillas={lista}
        plantillaSeleccionada={seleccionada}
        items={(items ?? []) as ChecklistItem[]}
      />
    </div>
  )
}
