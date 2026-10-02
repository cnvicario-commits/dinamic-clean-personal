import { describe, expect, it } from 'vitest'

const ready = Boolean(
  process.env.RUN_SUPABASE_INTEGRATION === '1' &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.POSTGREST_TEST_USER_JWT,
)

describe.skipIf(!ready)('Phase 6A justificaciones direct browser bypass negative', () => {
  it('storage upload is denied', async () => {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/justificaciones/deny/${crypto.randomUUID()}.pdf`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY!,
          authorization: `Bearer ${process.env.POSTGREST_TEST_USER_JWT}`,
          'content-type': 'application/pdf',
        },
        body: '%PDF-1.7\n%%EOF',
      },
    )
    expect(response.ok).toBe(false)
    expect([400, 401, 403]).toContain(response.status)
  })

  it('storage read and delete are denied for an existing private object', async () => {
    const path = `deny/${crypto.randomUUID()}.pdf`
    const url = `${process.env.SUPABASE_URL}/storage/v1/object/justificaciones/${path}`
    const serviceHeaders = {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    }
    const created = await fetch(url, {
      method: 'POST',
      headers: { ...serviceHeaders, 'content-type': 'application/pdf' },
      body: '%PDF-1.7\n%%EOF',
    })
    expect(created.ok).toBe(true)
    try {
      for (const method of ['GET', 'DELETE']) {
        const response = await fetch(url, {
          method,
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY!,
            authorization: `Bearer ${process.env.POSTGREST_TEST_USER_JWT}`,
          },
        })
        expect(response.ok).toBe(false)
        expect([400, 401, 403, 404]).toContain(response.status)
      }
    } finally {
      await fetch(url, { method: 'DELETE', headers: serviceHeaders })
    }
  })
})
