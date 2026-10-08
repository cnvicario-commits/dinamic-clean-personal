import { describe, expect, it } from 'vitest'
import { createJwtVerifier } from '../src/infrastructure/auth/jwt.js'
import { AppError } from '../src/http/errors/app-error.js'
import { signAccessToken, testEnv, TEST_ISSUER, TEST_JWT_SECRET } from './helpers.js'

describe('createJwtVerifier (HS256 fallback)', () => {
  const verifier = createJwtVerifier(testEnv())

  it('accepts valid HS256 token', async () => {
    const token = await signAccessToken({ sub: 'user-1', email: 'a@b.co' })
    const verified = await verifier.verify(token)
    expect(verified.sub).toBe('user-1')
    expect(verified.email).toBe('a@b.co')
  })

  it('rejects expired token with 401', async () => {
    const token = await signAccessToken({ sub: 'user-1', expiresIn: 0 })
    // jose treats exp === now as expired; small sleep avoids flake
    await new Promise((r) => setTimeout(r, 20))
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(AppError)
    await expect(verifier.verify(token)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects wrong issuer with 401', async () => {
    const token = await signAccessToken({
      sub: 'user-1',
      issuer: 'https://evil.example/auth/v1',
    })
    await expect(verifier.verify(token)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects wrong audience with 401', async () => {
    const token = await signAccessToken({
      sub: 'user-1',
      audience: 'not-authenticated',
    })
    await expect(verifier.verify(token)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects wrong signature with 401', async () => {
    const token = await signAccessToken({
      sub: 'user-1',
      secret: 'different-secret-value-xxxxx',
    })
    await expect(verifier.verify(token)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects malformed token', async () => {
    await expect(verifier.verify('not-a-jwt')).rejects.toMatchObject({ status: 401 })
  })

  it('documents expected issuer for HS256 path', () => {
    expect(TEST_ISSUER).toBe('https://example.supabase.co/auth/v1')
    expect(TEST_JWT_SECRET.length).toBeGreaterThan(8)
  })
})
