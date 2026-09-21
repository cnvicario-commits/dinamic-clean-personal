import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  /**
   * Service role key — server only. Used for Supabase Auth Admin
   * (create/delete user, set password, list auth users). Never for perfiles table writes
   * (Phase 2D: ProfilesRepository uses DATABASE_URL / dinamic_api). Never expose via NEXT_PUBLIC_*.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  /**
   * Optional HS256 fallback when JWKS verification fails (e.g. local/tests, legacy projects).
   * Prefer JWKS in production; set only when needed. Never expose via NEXT_PUBLIC_*.
   */
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  /** Graceful shutdown budget before forced exit(1). */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid configuration: ${details}`)
  }
  return parsed.data
}
