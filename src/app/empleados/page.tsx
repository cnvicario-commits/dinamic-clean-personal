import { createClient } from '@/utils/supabase/server'
import EmpleadoForm from '@/components/EmpleadoForm'
import EmpleadosTabla from '@/components/EmpleadosTabla'

export default async function EmpleadosPage() {
  const supabase = await createClient()

  const { data: empleados, error: errorEmpleados } = await supabase
    .from('empleados')
    .select(`
      *,
      asignaciones (
        fecha_desde,
        fecha_hasta,
        clientes ( id, nombre )
      )
    `)
    .order('nombre_apellido')

  console.log('ERROR EMPLEADOS:', errorEmpleados)
console.log('CANTIDAD EMPLEADOS:', empleados?.length)

  const { data: clientes, error: errorClientes } = await supabase
    .from('clientes')
    .select('id, nombre')
    .order('nombre')

  console.log('ERROR CLIENTES:', errorClientes)

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Empleados</h1>

      <EmpleadoForm />

      <EmpleadosTabla empleados={empleados ?? []} clientes={clientes ?? []} />
    </div>
  )
}