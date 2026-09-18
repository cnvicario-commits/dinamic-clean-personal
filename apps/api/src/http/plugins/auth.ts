import type { FastifyRequest } from 'fastify'
import { unauthorized, forbidden } from '../errors/app-error.js'
import { loadProfile } from '../../infrastructure/db/profiles-repo.js'
import type { AuthContext } from '../../domain/auth-context.js'
import { hasPermission, type Permission } from '../../domain/rbac.js'
import type { Db } from '../../infrastructure/db/pool.js'
import type { JwtVerifier } from '../../infrastructure/auth/jwt.js'

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

const PUBLIC_PATHS = new Set(['/healthz', '/readyz', '/openapi.json'])

export async function authenticateRequest(
  request: FastifyRequest,
  db: Db,
  jwtVerifier: JwtVerifier,
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

  const verified = await jwtVerifier.verify(token)
  const profile = await loadProfile(db, verified.sub)

  request.auth = {
    userId: verified.sub,
    profileId: profile.profileId,
    role: profile.role,
    email: verified.email,
    requestId: request.id,
  }
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest): Promise<void> => {
    if (!request.auth) {
      throw unauthorized()
    }
    if (!hasPermission(request.auth.role, permission)) {
      throw forbidden(`Missing permission: ${permission}`)
    }
  }
}
