import type { Role } from '../domain/rbac.js'

export type AuthContext = {
  userId: string
  profileId: string
  role: Role
  email: string | null
  requestId: string
}
