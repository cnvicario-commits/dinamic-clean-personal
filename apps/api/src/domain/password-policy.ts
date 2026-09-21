import { z } from 'zod'

/**
 * Single password policy for create / admin-set / future reset flows.
 * Matches existing product rule (min 6) — do not fork per-endpoint schemas.
 */
export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 200

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
