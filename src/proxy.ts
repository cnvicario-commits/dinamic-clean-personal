import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { puedeAcceder, type Rol } from '@/utils/permisos'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() lee la sesión de la cookie sin llamar a la red (solo lo hace
  // si el token está vencido, para refrescarlo). getUser() SIEMPRE revalida
  // contra el servidor de Auth de Supabase en cada request — como Proxy
  // corre en cada navegación (incluso las prefetcheadas), una llamada de red
  // puntual lenta o fallida acá rebota al usuario a /login justo después de
  // haber iniciado sesión bien, sin ningún error visible (es un redirect
  // HTTP, no una excepción de JS). La protección real de los datos la hace
  // RLS en cada tabla de Supabase, no este chequeo optimista.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && request.nextUrl.pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Control de acceso por rol: solo a nivel de app (oculta/bloquea la
  // navegación), no reemplaza RLS. Ver src/utils/permisos.ts.
  if (session && request.nextUrl.pathname !== '/login') {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', session.user.id)
      .single()

    if (!puedeAcceder((perfil?.rol as Rol) ?? null, request.nextUrl.pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = '/sin-acceso'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}