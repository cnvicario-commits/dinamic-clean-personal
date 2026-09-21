import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import UsuarioForm from '@/components/UsuarioForm'
import CambiarRolSelect from '@/components/CambiarRolSelect'
import CambiarPasswordBoton from '@/components/CambiarPasswordBoton'
import UsuarioEstadoBoton from '@/components/UsuarioEstadoBoton'
import { ROLES, type Rol } from '@/utils/permisos'
import {
  ApiClientError,
  createDinamicApiClient,
  type AdminUserResponse,
} from '@/lib/api/generated'

async function fetchUsersFromApi(accessToken: string): Promise<AdminUserResponse[]> {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!base) {
    throw new ApiClientError('API_URL / NEXT_PUBLIC_API_URL is not configured', 0, null)
  }
  const client = createDinamicApiClient({ baseUrl: base, accessToken })
  try {
    const data = await client.listUsers()
    return data.items
  } catch (e) {
    if (e instanceof ApiClientError) {
      if (e.status === 401 && e.problem?.code === 'user_disabled') {
        const supabase = await createClient()
        await supabase.auth.signOut()
        redirect('/login')
      }
      console.error('users_api_failed', {
        status: e.status,
        requestId: e.requestId,
        path: '/v1/users',
        code: e.problem?.code ?? null,
      })
      const hint =
        e.status === 503
          ? ' El API no tiene disponible el módulo de usuarios (revisá SUPABASE_SERVICE_ROLE_KEY en apps/api y reiniciá el backend).'
          : e.status === 0
            ? ' No se pudo conectar con el API (revisá API_URL y que apps/api esté en marcha).'
            : ''
      throw new ApiClientError(
        'No se pudieron cargar los usuarios. Reintentá o contactá a soporte.' + hint,
        e.status,
        e.requestId,
        e.problem,
      )
    }
    throw e
  }
}

export default async function UsuariosPage() {
  const supabase = await createClient()

  // proxy.ts already gates /usuarios to admin; this is a defense-in-depth UI check.
  // Authorization for data is enforced by Fastify profiles:read_any.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  let perfiles: AdminUserResponse[] = []
  let loadError: string | null = null
  try {
    perfiles = await fetchUsersFromApi(session.access_token)
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 403) {
      redirect('/sin-acceso')
    }
    loadError = e instanceof Error ? e.message : 'Error al cargar usuarios'
  }

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
        Usuarios existentes ({perfiles.length})
      </h2>
      {loadError ? (
        <p className="text-rose-600 text-sm mb-4">{loadError}</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Contraseña</th>
              </tr>
            </thead>
            <tbody>
              {perfiles.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-800">{p.nombreCompleto}</td>
                  <td className="px-4 py-3 text-slate-600">{p.email ?? '-'}</td>
                  <td className="px-4 py-3">
                    <CambiarRolSelect perfilId={p.id} rolActual={(p.rol as Rol) ?? null} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`text-xs ${
                          p.status === 'DISABLED'
                            ? 'text-rose-600'
                            : p.status === 'MISSING_AUTH'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {p.status === 'DISABLED'
                          ? 'Deshabilitado'
                          : p.status === 'MISSING_AUTH'
                            ? 'Sin Auth'
                            : 'Activo'}
                      </span>
                      {p.status !== 'MISSING_AUTH' ? (
                        <UsuarioEstadoBoton perfilId={p.id} disabled={Boolean(p.disabled)} />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CambiarPasswordBoton perfilId={p.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Roles disponibles: {ROLES.map((r) => r.etiqueta).join(', ')}.
      </p>
    </div>
  )
}
