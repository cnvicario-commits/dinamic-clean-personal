import { createClient } from '@/utils/supabase/server'
import AusenciaForm from '@/components/AusenciaForm'
import ExportarAusencias from '@/components/ExportarAusencias'
export default async function AusenciasPage() {
  const supabase = await createClient()
  const { data: empleados } = await supabase
    .from('empleados')
    .select('id, nombre_apellido')
    .order('nombre_apellido')
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .order('nombre')
  const { data: asignaciones } = await supabase
    .from('asignaciones')
    .select('empleado_id, cliente_id')
    .is('fecha_hasta', null)
  const { data: codigos } = await supabase
    .from('codigos_novedad')
    .select('codigo, descripcion')
    .order('codigo')
  const { data: asistencias } = await supabase
    .from('asistencias')
    .select('id, fecha, codigo, horas_extras, observaciones, archivo_url, empleados(nombre_apellido)')
    .order('fecha', { ascending: false })
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Novedades</h1>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 mb-8">
        <AusenciaForm
          empleados={empleados || []}
          clientes={clientes || []}
          asignaciones={asignaciones || []}
          codigos={codigos || []}
        />
      </div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Listado ({asistencias?.length ?? 0})
        </h2>
        <ExportarAusencias asistencias={(asistencias || []) as any} />
      </div>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Empleado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Horas extra</th>
              <th className="px-4 py-3 font-medium">Observaciones</th>
              <th className="px-4 py-3 font-medium">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {asistencias?.map((a: any) => (
              <tr key={a.id} className="border-b border-slate-100