import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  // getSession() lee la sesión de la cookie sin llamar a la red (solo lo hace
  // si el token está vencido, para refrescarlo). getUser() SIEMPRE revalida
  // contra el servidor de Auth de Supabase; usarlo acá para un simple
  // redirect de UX es innecesario y, si esa llamada de red es lenta o falla
  // de forma intermitente, rebota al usuario a /login justo después de haber
  // iniciado sesión bien. La protección real de los datos la hace RLS.
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  redirect('/portal')
}