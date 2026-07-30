import { createClient } from '@/utils/supabase/server'
import AusenciaForm from '@/components/AusenciaForm'

export default async function AusenciasPage() {
  const supabase = await createClient()

  const { data: empleados } = await supabase
    .from('empleados')
    .select('id, nombre_apellido')
    .order('nombre_apellido')

  const { data: ausencias } = await supabase
    .from('ausencias')
    .select('id, fecha, justificada, observaciones, archivo_url, empleados(nombre_apellido)')
    .order('fecha', { ascending: false })

  return (
    <div style={{ padding: '2rem', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Ausencias</h1>

      <AusenciaForm empleados={empleados || []} />

      <h2 style={{ fontSize: '1.1rem', margin: '2rem 0 1rem' }}>Listado</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '0.5rem' }}>Empleado</th>
            <th style={{ padding: '0.5rem' }}>Fecha</th>
            <th style={{ padding: '0.5rem' }}>Estado</th>
            <th style={{ padding: '0.5rem' }}>Observaciones</th>
            <th style={{ padding: '0.5rem' }}>Archivo</th>
          </tr>
        </thead>
        <tbody>
          {ausencias?.map((a: any) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{a.empleados?.nombre_apellido}</td>
              <td style={{ padding: '0.5rem' }}>{a.fecha}</td>
              <td style={{ padding: '0.5rem' }}>{a.justificada ? 'Justificada' : 'Injustificada'}</td>
              <td style={{ padding: '0.5rem' }}>{a.observaciones}</td>
              <td style={{ padding: '0.5rem' }}>
                {a.archivo_url ? <a href={a.archivo_url} target="_blank">Ver</a> : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {ausencias?.length === 0 && <p>No hay ausencias cargadas todavía.</p>}
    </div>
  )
}