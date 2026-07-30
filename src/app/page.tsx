import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import LogoutButton from '@/components/LogoutButton'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre_completo, rol')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        Bienvenido a Dinamic Clean
      </h1>
      <p style={{ marginBottom: '0.5rem' }}>Email: {user.email}</p>
      <p style={{ marginBottom: '1.5rem' }}>Rol: {perfil?.rol ?? 'sin asignar'}</p>
      <LogoutButton />
    </div>
  )
}