import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * BFF proxy for users/profile mutations — single writer is Fastify (`apps/api`).
 * Does NOT use service role. Forwards the caller JWT so RBAC is enforced on the API.
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

async function forward(path: string, init: RequestInit): Promise<NextResponse> {
  const token = await sessionAccessToken()
  if (!token) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
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

  if (!res.ok) {
    const problem = payload as { detail?: string; title?: string; error?: string } | null
    const message =
      problem?.detail ?? problem?.title ?? problem?.error ?? 'Error en la API de usuarios.'
    return NextResponse.json({ error: message }, { status: res.status })
  }

  return NextResponse.json(payload, { status: res.status })
}

/** Exact-key allowlist for compat PATCH bodies. */
function exactKeys(body: Record<string, unknown>, allowed: string[]): boolean {
  const keys = Object.keys(body).sort()
  const expect = [...allowed].sort()
  return keys.length === expect.length && keys.every((k, i) => k === expect[i])
}

export async function GET() {
  try {
    return await forward('/v1/users', { method: 'GET' })
  } catch (e) {
    return NextResponse.json(
      { error: 'Error inesperado: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    return await forward('/v1/users', { method: 'POST', body })
  } catch (e) {
    return NextResponse.json(
      { error: 'Error inesperado: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    )
  }
}

/**
 * Compat shim:
 * - exactly { id, rol } → PATCH /v1/users/:id/role
 * - exactly { id, password } → POST /v1/users/:id/password
 */
export async function PATCH(request: Request) {
  try {
    const raw = (await request.json()) as unknown
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })
    }
    const body = raw as Record<string, unknown>

    if (exactKeys(body, ['id', 'rol'])) {
      if (typeof body.id !== 'string' || typeof body.rol !== 'string') {
        return NextResponse.json({ error: 'Tipos inválidos.' }, { status: 400 })
      }
      return await forward(`/v1/users/${body.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ rol: body.rol }),
      })
    }

    if (exactKeys(body, ['id', 'password'])) {
      if (typeof body.id !== 'string' || typeof body.password !== 'string') {
        return NextResponse.json({ error: 'Tipos inválidos.' }, { status: 400 })
      }
      return await forward(`/v1/users/${body.id}/password`, {
        method: 'POST',
        body: JSON.stringify({ password: body.password }),
      })
    }

    return NextResponse.json(
      { error: 'Payload no permitido. Usá exactamente {id,rol} o {id,password}.' },
      { status: 400 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: 'Error inesperado: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    )
  }
}
