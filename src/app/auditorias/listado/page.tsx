import { createClient } from '@/utils/supabase/server'
import ListadoAuditoriasTabla from '@/components/ListadoAuditoriasTabla'
import type { AuditoriaListado, RespuestaConteo } from '@/types/auditoria'

export default async function ListadoAuditoriasPage() {
  const supabase = await createClient()

  const [{ data: auditorias }, { data: respuestas }, { data: supervisores }] = await Promise.all([
    supabase
      .from('auditorias')
      .select('id, fecha_realizada, evaluacion_general, cliente_domicilios(alias, direccion, clientes(nombre)), perfiles(nombre_completo)')
      .order('fecha_realizada', { ascending: false }),
    supabase.from('auditoria_respuestas').select('auditoria_id, resultado'),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
  ])

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Auditorías realizadas</h1>
      <ListadoAuditoriasTabla
        auditorias={(auditorias ?? []) as unknown as AuditoriaListado[]}
        respuestas={(respuestas ?? []) as RespuestaConteo[]}
        supervisores={supervisores ?? []}
      />
    </div>
  )
}
