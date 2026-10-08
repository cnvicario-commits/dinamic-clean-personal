import { describe, expect, it } from 'vitest'
import {
  extractProjectRefFromDatabaseUrl,
  extractSupabaseProjectRefFromUrl,
} from './supabase-test-guard.js'

describe('Supabase project ref parsing', () => {
  it('reads ref from SUPABASE_URL', () => {
    expect(extractSupabaseProjectRefFromUrl('https://edruejzwwnixsjsadbgb.supabase.co/')).toBe(
      'edruejzwwnixsjsadbgb',
    )
  })

  it('reads ref from pooler username', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://dinamic_api.edruejzwwnixsjsadbgb:secret@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
      ),
    ).toBe('edruejzwwnixsjsadbgb')
  })

  it('reads ref from direct db host without mistaking TLD .co for ref', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres:secret@db.edruejzwwnixsjsadbgb.supabase.co:5432/postgres',
      ),
    ).toBe('edruejzwwnixsjsadbgb')
  })
})
