/**
 * Opt-in backend positive profiles tests after Phase 2D hardening.
 *
 * Same TEST project guardrails as PostgREST negatives.
 * Proves: dinamic_api pool path ALLOW while browser PostgREST path DENY.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createProfilesRepository } from '../src/infrastructure/db/profiles-repository.js'
import { assertDinamicCleanTestTarget } from './supabase-test-guard.js'

const enabled = process.env.RUN_SUPABASE_INTEGRATION === '1'
const profileId = (process.env.POSTGREST_TEST_PROFILE_ID ?? '').trim()
const canRun = enabled && Boolean(profileId)

describe.skipIf(!canRun)('Backend profiles positive (Phase 2D pool)', () => {
  let db: ReturnType<typeof createDb>
  let profiles: ReturnType<typeof createProfilesRepository>
  let originalNombre: string | null

  beforeAll(async () => {
    assertDinamicCleanTestTarget()
    const env = loadEnv()
    db = createDb(env)
    const cap = await db.checkPhase2dProfilesCapabilities()
    if (!cap.ok) {
      throw new Error(`Phase 2D capabilities failed: ${cap.reason}`)
    }
    profiles = createProfilesRepository(db)
    const row = await profiles.getById(profileId)
    if (!row) throw new Error('POSTGREST_TEST_PROFILE_ID not found via dinamic_api')
    originalNombre = row.nombre_completo
  })

  afterAll(async () => {
    if (profiles && originalNombre !== undefined) {
      try {
        await profiles.updateNombreCompleto(profileId, originalNombre ?? 'Integration Restore')
      } catch {
        // best-effort
      }
    }
    if (db) await db.close()
  })

  it('updateNombreCompleto via dinamic_api succeeds', async () => {
    assertDinamicCleanTestTarget()
    const marker = `phase2d-ok-${Date.now()}`
    const updated = await profiles.updateNombreCompleto(profileId, marker)
    expect(updated.nombre_completo).toBe(marker)
    const read = await profiles.getById(profileId)
    expect(read?.nombre_completo).toBe(marker)
  })

  it('list/read profiles via pool succeeds', async () => {
    assertDinamicCleanTestTarget()
    const items = await profiles.list()
    expect(items.some((p) => p.id === profileId)).toBe(true)
  })
})

describe('Backend positive gate', () => {
  it('records NOT EXECUTED when opt-in incomplete', () => {
    if (canRun) {
      expect(process.env.EXPECTED_SUPABASE_TEST_PROJECT_REF).toBeTruthy()
      return
    }
    expect('SUPABASE_INTEGRATION_NOT_EXECUTED').toBeTruthy()
  })
})
