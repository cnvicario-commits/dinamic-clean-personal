import { describe, it } from 'vitest'

/**
 * Negative PostgREST RLS check for empleados — NOT mandatory until FE migrates off direct Supabase.
 *
 * When mandatory (see docs/phase-1-postgrest-rbac-gap.md):
 * 1. Obtain a real JWT for a role without employees:read (e.g. compras).
 * 2. GET `{SUPABASE_URL}/rest/v1/empleados?select=id` with that JWT + anon key.
 * 3. Expect denial or empty after RLS is tightened (today: any authenticated can SELECT).
 *
 * Do not enable against production. Do not change RLS in Phase 1 foundation.
 */
const postgrestNegativeReady = false

describe.skipIf(!postgrestNegativeReady)('postgrest empleados RLS negative (deferred)', () => {
  it('non-privileged authenticated role cannot list empleados via PostgREST', async () => {
    // Placeholder — enable when close criteria in docs/phase-1-postgrest-rbac-gap.md are met.
    throw new Error('Not implemented: wire real PostgREST call when FE migration complete')
  })
})
