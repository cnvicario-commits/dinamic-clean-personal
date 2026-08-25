import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cliente con la service role key: puede crear usuarios de Auth y salta RLS.
// SOLO se usa server-side (dentro de Route Handlers) — nunca se importa desde
// un componente cliente ni se expone SUPABASE_SERVICE_ROLE_KEY con el
// prefijo NEXT_PUBLIC_, o terminaría en el bundle del navegador.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_URL) en las variables de entorno.'
    )
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
