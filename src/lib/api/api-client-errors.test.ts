import { describe, expect, it, vi } from 'vitest'
import { ApiClientError, createDinamicApiClient } from './generated/client'

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('createDinamicApiClient request handling', () => {
  const baseUrl = 'http://api.test'

  it('sends Bearer token on requests', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { id: 'u', email: 'a@b.c' }))
    const client = createDinamicApiClient({
      baseUrl,
      accessToken: 'test-token',
      fetch: fetchImpl as typeof fetch,
    })
    await client.getMe()
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(firstCall[1].headers).toMatchObject({ Authorization: 'Bearer test-token' })
  })

  it('throws ApiClientError with problem details on 401', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(401, {
        title: 'Unauthorized',
        detail: 'Invalid token',
        requestId: 'req-401',
      }),
    )
    const client = createDinamicApiClient({
      baseUrl,
      accessToken: 'bad',
      fetch: fetchImpl as typeof fetch,
    })
    await expect(client.getMe()).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 401,
      message: 'Invalid token',
      requestId: 'req-401',
    })
  })

  it('throws ApiClientError on 403', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(403, { detail: 'Forbidden' }, { 'x-request-id': 'req-403' }),
    )
    const client = createDinamicApiClient({
      baseUrl,
      accessToken: 'tok',
      fetch: fetchImpl as typeof fetch,
    })
    await expect(client.listClients()).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 403,
      requestId: 'req-403',
    })
  })

  it('surfaces non-JSON error bodies via status text', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('gateway timeout', {
          status: 502,
          headers: { 'content-type': 'text/plain' },
        }),
    )
    const client = createDinamicApiClient({
      baseUrl,
      accessToken: 'tok',
      fetch: fetchImpl as typeof fetch,
    })
    await expect(client.getMe()).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(ApiClientError)
      const e = err as ApiClientError
      expect(e.status).toBe(502)
      expect(e.message.length).toBeGreaterThan(0)
      return true
    })
  })

  it('propagates network failures from fetch', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const client = createDinamicApiClient({
      baseUrl,
      accessToken: 'tok',
      fetch: fetchImpl as typeof fetch,
    })
    await expect(client.getMe()).rejects.toThrow('Failed to fetch')
  })

  it('handles 204 empty responses', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 204, headers: { 'content-type': 'application/json' } }),
    )
    const client = createDinamicApiClient({
      baseUrl,
      accessToken: 'tok',
      fetch: fetchImpl as typeof fetch,
    })
    await expect(client.disableUser('11111111-1111-4111-8111-111111111111')).resolves.toBeUndefined()
  })
})
