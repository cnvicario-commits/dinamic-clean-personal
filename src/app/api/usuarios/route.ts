import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ROLES } from '@/utils/permisos'

// Devuelve el id del que llama si está logueado y es admin, o null si no.
// Se resuelve con el cliente normal (respeta la sesión de las cookies de
// quien hace el pedido) — el cliente admin recién se usa después de este
// chequeo, para las operaciones que sí requieren saltar RLS/crear usuarios.
async function idSiEsAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', session.user.id)
    .single()

  return perfil?.rol === 'admin' ? session.user.id : null
}

const ROLES_VALIDOS = ROLES.map((r) => r.valor)

export async function POST(request: Request) {
  // Envuelve todo el handler: si algo tira una excepción de verdad (no un
  // {error} de Supabase, sino un throw real — ej. falta la service role key,
  // o un error de red) Next.js devolvería una página de error que no es
  // JSON, y el cliente no podría mostrar ningún mensaje. Acá se atraviesa
  // eso y siempre se devuelve JSON.
  try {
    const adminId = await idSiEsAdmin()
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, nombreCompleto, rol } = body as {
      email?: string
      password?: string
      nombreCompleto?: string
      rol?: string
    }

    if (!email || !password || !nombreCompleto || !rol) {
      return NextResponse.json({ error: 'Faltan datos: email, contraseña, nombre y rol son obligatorios.' }, { status: 400 })
    }
    if (!ROLES_VALIDOS.includes(rol as (typeof ROLES_VALIDOS)[number])) {
      return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña tiene que tener al menos 6 caracteres.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: nuevoUsuario, error: errAuth } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no manda email de invitación: la contraseña se la pasás vos
    })
    if (errAuth || !nuevoUsuario.user) {
      return NextResponse.json({ error: 'Error al crear el usuario: ' + (errAuth?.message ?? 'desconocido') }, { status: 400 })
    }

    const { error: errPerfil } = await admin
      .from('perfiles')
      .upsert({ id: nuevoUsuario.user.id, nombre_completo: nombreCompleto, rol })
    if (errPerfil) {
      // El usuario de Auth ya se creó; si el perfil falla, lo dejamos creado
      // igual (se le puede cargar el perfil a mano) en vez de dejarlo en un
      // estado a medio camino más confuso de resolver.
      return NextResponse.json(
        { error: 'El usuario se creó pero falló al guardar el perfil: ' + errPerfil.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ id: nuevoUsuario.user.id })
  } catch (e) {
    return NextResponse.json({ error: 'Error inesperado: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const adminId = await idSiEsAdmin()
    if (!adminId) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }

    const body = await request.json()
    const { id, rol } = body as { id?: string; rol?: string }

    if (!id || !rol) {
      return NextResponse.json({ error: 'Faltan datos: id y rol son obligatorios.' }, { status: 400 })
    }
    if (!ROLES_VALIDOS.includes(rol as (typeof ROLES_VALIDOS)[number])) {
      return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('perfiles').update({ rol }).eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Error al actualizar el rol: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Error inesperado: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 })
  }
}
