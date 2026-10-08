import type { Role } from '../domain/rbac.js'
import type { AuthAssuranceLevel } from '../domain/mfa-policy.js'

export type AuthContext = {
  userId: string
  profileId: string
  role: Role
  email: string | null
  nombreCompleto: string | null
  /** Supabase Auth assurance level from JWT (`aal` claim). Never trust JWT for role. */
  aal: AuthAssuranceLevel
  requestId: string
}
