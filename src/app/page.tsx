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
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Bienvenido a Dinamic Clean
        </h1>
        <p className="text-slate-600 mb-1">
          <span className="font-medium text-slate-800">Email:</span> {user.email}
        </p>
        <p className="text-slate-600 mb-6">
          <span className="font-medium text-slate-800">Rol:</span>{' '}
          <span className="inline-block px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium uppercase">
            {perfil?.rol ?? 'sin asignar'}
          </span>
        </p>
        <LogoutButton />
      </div>
    </div>
  )
}