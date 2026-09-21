import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * BFF: POST /api/usuarios/:id/disable|enable → Fastify lifecycle endpoints.
 * No service role. Authorization enforced by API.
 */

function apiBase(): string {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!base) {
    throw new Error('API_URL / NEXT_PUBLIC_API_URL is not configured')
  }
  return base.replace(/\/$/, '')
}

async function sessionAccessToken(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const { id, action } = await context.params
    if (action !== 'disable' && action !== 'enable') {
      return NextResponse.json({ error: 'Acción no permitida.' }, { status: 400 })
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Id inválido.' }, { status: 400 })
    }

    const token = await sessionAccessToken()
    if (!token) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }

    const res = await fetch(`${apiBase()}/v1/users/${id}/${action}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    const text = await res.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text) as unknown
      } catch {
        payload = { error: text }
      }
    }

    const problem = payload as { detail?: string; title?: string; code?: string; error?: string } | null
    if (problem?.code === 'user_disabled') {
      const supabase = await createClient()
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: 'Usuario deshabilitado.', code: 'user_disabled' },
        { status: 401 },
      )
    }

    const message =
      problem?.detail ?? problem?.title ?? problem?.error ?? 'Error en la API de usuarios.'
    return NextResponse.json(
      { error: message, ...(problem?.code ? { code: problem.code } : {}) },
      { status: res.status },
    )
  } catch {
    return NextResponse.json(
      { error: 'Error interno al comunicarse con el servicio de usuarios.' },
      { status: 500 },
    )
  }
}
