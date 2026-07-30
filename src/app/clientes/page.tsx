import { createClient } from '@/utils/supabase/server'
import ClienteForm from '@/components/ClienteForm'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .order('nombre')

  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Clientes</h1>

      <ClienteForm />

      <h2 style={{ fontSize: '1.1rem', margin: '2rem 0 1rem' }}>Listado</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {clientes?.map((cliente) => (
          <li
            key={cliente.id}
            style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: '4px', marginBottom: '0.5rem' }}
          >
            {cliente.nombre}
          </li>
        ))}
      </ul>

      {clientes?.length === 0 && <p>No hay clientes cargados todavía.</p>}
    </div>
  )
}