import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import UsuarioForm from '@/components/UsuarioForm'
import CambiarRolSelect from '@/components/CambiarRolSelect'
import CambiarPasswordBoton from '@/components/CambiarPasswordBoton'
import { ROLES, type Rol } from '@/utils/permisos'

export default async function UsuariosPage() {
  const supabase = await createClient()

  // src/proxy.ts ya bloquea esta ruta para quien no sea admin; este chequeo
  // es solo un respaldo (por si algún día se navega acá sin pasar por él).
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: miPerfil } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
  if (miPerfil?.rol !== 'admin') redirect('/sin-acceso')

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, nombre_completo, rol')
    .order('nombre_completo')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Usuarios</h1>
      <p className="text-sm text-slate-500 mb-6">
        Alta de usuarios y roles. Los roles controlan qué módulos ve cada uno dentro de la app.
      </p>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Nuevo usuario</h2>
      <div className="mb-8">
        <UsuarioForm />
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Usuarios existentes ({perfiles?.length ?? 0})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Contraseña</th>
            </tr>
          </thead>
          <tbody>
            {(perfiles ?? []).map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">{p.nombre_completo}</td>
                <td className="px-4 py-3">
                  <CambiarRolSelect perfilId={p.id} rolActual={(p.rol as Rol) ?? null} />
                </td>
                <td className="px-4 py-3">
                  <CambiarPasswordBoton perfilId={p.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Roles disponibles: {ROLES.map((r) => r.etiqueta).join(', ')}.
      </p>
    </div>
  )
}
