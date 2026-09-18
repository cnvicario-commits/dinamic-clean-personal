import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { createSecretKey } from 'node:crypto'
import type { Env } from '../../config/env.js'
import { unauthorized } from '../../http/errors/app-error.js'

export type VerifiedToken = {
  sub: string
  email: string | null
  payload: JWTPayload
}

export type JwtVerifier = {
  verify: (token: string) => Promise<VerifiedToken>
}

/**
 * Cryptographic JWT verification (jose).
 *
 * Primary: JWKS at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (issuer + audience checks).
 * Fallback: HS256 with `SUPABASE_JWT_SECRET` when JWKS fails (local/tests, legacy HMAC projects).
 * Prefer JWKS in production; the secret is optional and must never appear in NEXT_PUBLIC_*.
 */
export function createJwtVerifier(env: Env): JwtVerifier {
  const issuer = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`
  const jwksUrl = new URL(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`)
  const jwks = createRemoteJWKSet(jwksUrl)

  return {
    async verify(token: string): Promise<VerifiedToken> {
      if (!token || token.split('.').length !== 3) {
        throw unauthorized('Invalid token')
      }

      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer,
          // Supabase access tokens commonly use audience "authenticated"
          audience: 'authenticated',
        })
        return mapPayload(payload)
      } catch {
        if (!env.SUPABASE_JWT_SECRET) {
          throw unauthorized('Invalid or expired token')
        }
        try {
          const key = createSecretKey(Buffer.from(env.SUPABASE_JWT_SECRET))
          const { payload } = await jwtVerify(token, key, {
            issuer,
            audience: 'authenticated',
            algorithms: ['HS256'],
          })
          return mapPayload(payload)
        } catch {
          throw unauthorized('Invalid or expired token')
        }
      }
    },
  }
}

function mapPayload(payload: JWTPayload): VerifiedToken {
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw unauthorized('Token missing subject')
  }
  const email =
    typeof payload.email === 'string'
      ? payload.email
      : typeof (payload as { user_metadata?: { email?: string } }).user_metadata?.email === 'string'
        ? (payload as { user_metadata: { email: string } }).user_metadata.email
        : null
  return { sub: payload.sub, email, payload }
}
