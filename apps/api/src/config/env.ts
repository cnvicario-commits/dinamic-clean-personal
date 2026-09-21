import { z } from 'zod'

/** Accept true/false/1/0 (string or boolean/number) from process env. */
const booleanish = z.union([z.boolean(), z.string(), z.number()]).transform((val, ctx) => {
  if (val === true || val === 1 || val === '1' || val === 'true') return true
  if (val === false || val === 0 || val === '0' || val === 'false') return false
  ctx.addIssue({
    code: 'custom',
    message: 'Expected boolean (true/false/1/0)',
  })
  return z.NEVER
})

/** IPv4, IPv4/CIDR, or simple IPv6-ish (colons + optional /prefix). Rejects *, true, empty. */
function isValidProxyCidrEntry(entry: string): boolean {
  const s = entry.trim()
  if (!s) return false
  const lower = s.toLowerCase()
  if (lower === '*' || lower === 'true' || lower === 'false') return false
  if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(s)) return true
  if (s.includes(':') && /^[0-9a-fA-F:]+(\/\d{1,3})?$/.test(s)) return true
  return false
}

function parseTrustProxyCidrs(raw: string | undefined): string[] {
  if (raw == null || raw.trim() === '') return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const envSchema = z
  .object({
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
    /**
     * Comma-separated IPs/CIDRs of trusted reverse proxies for X-Forwarded-* / req.ip.
     * Empty/unset → trustProxy false (Compose publishes :3001 directly).
     * Never set to "*", "true", or unbounded trustProxy: true.
     */
    TRUST_PROXY_CIDRS: z.string().optional().default(''),
    /**
     * When false, skip registering global + sensitive rate limiters.
     * Default: true in development/production, false in test (avoids flaky suites).
     */
    RATE_LIMIT_ENABLED: booleanish.optional(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    /**
     * Per-window max requests per client IP (general).
     * Default 600: pre-auth / network abuse budget for NAT/BFF shared IPs.
     * Sensitive mutations stay at RATE_LIMIT_SENSITIVE_MAX (20/user).
     */
    RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().positive().default(600),
    /** Per-window max privileged mutations per authenticated userId. */
    RATE_LIMIT_SENSITIVE_MAX: z.coerce.number().int().positive().default(20),
  })
  .superRefine((data, ctx) => {
    const origins = data.CORS_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (origins.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGIN'],
        message: 'must list at least one origin after split',
      })
    }
    for (const origin of origins) {
      if (origin === '*') {
        if (data.NODE_ENV === 'production') {
          ctx.addIssue({
            code: 'custom',
            path: ['CORS_ORIGIN'],
            message: 'wildcard * is not allowed in production (credentials require explicit origins)',
          })
        }
        continue
      }
      try {
        const u = new URL(origin)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          ctx.addIssue({
            code: 'custom',
            path: ['CORS_ORIGIN'],
            message: `origin must use http: or https: protocol (${origin})`,
          })
        }
      } catch {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGIN'],
          message: `origin must be an absolute URL with scheme (${origin})`,
        })
      }
    }

    const cidrs = parseTrustProxyCidrs(data.TRUST_PROXY_CIDRS)
    for (const entry of cidrs) {
      if (!isValidProxyCidrEntry(entry)) {
        ctx.addIssue({
          code: 'custom',
          path: ['TRUST_PROXY_CIDRS'],
          message: `invalid proxy IP/CIDR entry: ${entry}`,
        })
      }
    }
  })
  .transform((data) => ({
    ...data,
    TRUST_PROXY_CIDRS: parseTrustProxyCidrs(data.TRUST_PROXY_CIDRS),
    RATE_LIMIT_ENABLED: data.RATE_LIMIT_ENABLED ?? data.NODE_ENV !== 'test',
  }))

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
