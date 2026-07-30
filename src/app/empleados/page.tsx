import { createClient } from '@/utils/supabase/server'
import EmpleadoForm from '@/components/EmpleadoForm'

export default async function EmpleadosPage() {
  const supabase = await createClient()
  const { data: empleados } = await supabase
    .from('empleados')
    .select('*')
    .order('nombre_apellido')

  return (
    <div style={{ padding: '2rem', maxWidth: '700px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Empleados</h1>

      <EmpleadoForm />

      <h2 style={{ fontSize: '1.1rem', margin: '2rem 0 1rem' }}>Listado</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '0.5rem' }}>Nombre y apellido</th>
            <th style={{ padding: '0.5rem' }}>CUIL</th>
            <th style={{ padding: '0.5rem' }}>Fecha de ingreso</th>
          </tr>
        </thead>
        <tbody>
          {empleados?.map((emp) => (
            <tr key={emp.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{emp.nombre_apellido}</td>
              <td style={{ padding: '0.5rem' }}>{emp.cuil}</td>
              <td style={{ padding: '0.5rem' }}>{emp.fecha_ingreso}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {empleados?.length === 0 && <p>No hay empleados cargados todavía.</p>}
    </div>
  )
}