import type { FastifyRequest } from 'fastify'
import { unauthorized, forbidden, mfaRequired } from '../errors/app-error.js'
import { loadProfile } from '../../infrastructure/db/profiles-repo.js'
import type { AuthContext } from '../../domain/auth-context.js'
import { authorize, type Permission } from '../../domain/rbac.js'
import { parseAal, sessionMeetsMfaRequirement } from '../../domain/mfa-policy.js'
import type { Db } from '../../infrastructure/db/pool.js'
import type { JwtVerifier } from '../../infrastructure/auth/jwt.js'
import type { IdentityAdmin } from '../../infrastructure/auth/identity-admin.js'

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

const PUBLIC_PATHS = new Set(['/healthz', '/readyz', '/openapi.json'])

export type AuthenticateDeps = {
  db: Db
  jwtVerifier: JwtVerifier
  /** When ready, ban/disable checks use Auth Admin (fail-closed under dinamic_api). */
  identityAdmin?: IdentityAdmin | null
}

export async function authenticateRequest(
  request: FastifyRequest,
  deps: AuthenticateDeps,
): Promise<void> {
  const path = (request.url.split('?')[0] ?? '').replace(/\/$/, '') || '/'
  if (PUBLIC_PATHS.has(path)) {
    return
  }

  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized('Missing bearer token')
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw unauthorized('Missing bearer token')
  }

  const verified = await deps.jwtVerifier.verify(token)
  const identity =
    deps.identityAdmin && typeof deps.identityAdmin.getAuthUserSecurityState === 'function'
      ? deps.identityAdmin
      : null
  const profile = await loadProfile(deps.db, verified.sub, { identity })

  request.auth = {
    userId: verified.sub,
    profileId: profile.profileId,
    role: profile.role,
    email: verified.email,
    aal: parseAal(verified.payload.aal),
    requestId: request.id,
  }
}

/**
 * HTTP guard → canonical authorize(subject, permission).
 * Does not call role×permission helpers directly.
 */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.auth) {
      throw unauthorized()
    }
    if (!authorize(request.auth, permission)) {
      throw forbidden(`Missing permission: ${permission}`)
    }
  }
}

/**
 * Step-up MFA for privileged user-admin routes when actor role requires MFA.
 * Uses JWT `aal` claim (Supabase native). UI enrollment is not sufficient.
 */
export function requireMfaForPrivilegedActor() {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.auth) {
      throw unauthorized()
    }
    if (!sessionMeetsMfaRequirement(request.auth.role, request.auth.aal)) {
      throw mfaRequired('AAL2 required for this operation')
    }
  }
}
