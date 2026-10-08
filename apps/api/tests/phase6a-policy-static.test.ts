import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('../../../supabase/migrations/forward/20261002160000_phase6a_attendance_justifications.sql', import.meta.url),
  'utf8',
)

describe('Phase 6A justificaciones browser bypass closure migration', () => {
  it('adds server-managed storage path column', () => {
    expect(sql).toContain('archivo_storage_path')
  })
  it('extends dinamic_api column grants for justification path', () => {
    expect(sql).toContain('archivo_storage_path')
    expect(sql).toMatch(/GRANT INSERT[\s\S]*archivo_storage_path[\s\S]*TO dinamic_api/i)
    expect(sql).toMatch(/GRANT UPDATE[\s\S]*archivo_storage_path[\s\S]*TO dinamic_api/i)
  })
  it('drops known manual justificaciones policy names when present', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS justificaciones_storage_authenticated_all')
    expect(sql).toContain('DROP POLICY IF EXISTS justificaciones_authenticated_all')
  })
  it('removes browser policies scoped to justificaciones bucket by name or bucket_id expression', () => {
    expect(sql).toContain("LIKE '%justificaciones%'")
    expect(sql).toContain("bucket_id[\\s]*=[\\s]*''justificaciones'''")
    expect(sql).toContain("DROP POLICY %I ON storage.objects")
  })
  it('documents that unscoped permissive storage policies need env-specific review', () => {
    expect(sql).toContain('USING (true)')
    expect(sql).toContain('integration tests')
  })
})
