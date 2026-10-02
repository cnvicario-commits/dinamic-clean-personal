import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../src/http/errors/app-error.js'
import { parseImportPayload } from '../src/http/parse-import-payload.js'
import { articleImportBody } from '../src/http/schemas/catalog.js'
import {
  createAttendanceJustificationsService,
  decodeJustificationFile,
} from '../src/application/attendance/attendance-justifications-service.js'
import type { AttendanceRepository } from '../src/infrastructure/db/attendance-repository.js'
import type { AttendanceJustificationsStorage } from '../src/infrastructure/storage/attendance-justifications-storage.js'
import { CATALOG_IMPORT_MAX_ROWS } from '../src/domain/import-limits.js'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

const phase6cSql = readFileSync(
  new URL(
    '../../../supabase/migrations/forward/20261002163000_phase6c_hot_path_indexes.sql',
    import.meta.url,
  ),
  'utf8',
)

describe('phase 6C hot-path indexes migration', () => {
  it('does not add speculative indexes without DB evidence', () => {
    expect(phase6cSql).not.toMatch(/CREATE INDEX/i)
  })
})

describe('phase 6C import limit observability', () => {
  it('logs structured rejection when catalog import exceeds row cap', () => {
    const rows = Array.from({ length: CATALOG_IMPORT_MAX_ROWS + 1 }, (_, i) => ({
      fila: i + 2,
      nombre: `A-${i}`,
    }))
    const warn = vi.fn()
    const req = {
      id: 'req-6c',
      body: { rows },
      log: { warn },
    }
    expect(() =>
      parseImportPayload(req as never, articleImportBody, 'articles.import', 'Invalid catalog payload'),
    ).toThrow(/Invalid catalog payload/)
    expect(warn).toHaveBeenCalledWith(
      {
        requestId: 'req-6c',
        operation: 'articles.import',
        reason: 'import_limit',
        result: 'rejected',
      },
      'import payload rejected by limit',
    )
  })

  it('does not log import_limit when a field max length is exceeded', () => {
    const warn = vi.fn()
    const req = {
      id: 'req-field',
      body: {
        rows: [{ fila: 2, nombre: 'x'.repeat(501) }],
      },
      log: { warn },
    }
    expect(() =>
      parseImportPayload(req as never, articleImportBody, 'articles.import', 'Invalid catalog payload'),
    ).toThrow(/Invalid catalog payload/)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('phase 6C justification compensation observability', () => {
  const ATT = '11111111-1111-4111-8111-111111111111'
  const EMP = '22222222-2222-4222-8222-222222222222'

  it('includes stage when storage delete compensation fails after metadata update error', async () => {
    const log = vi.fn()
    const storage = {
      upload: vi.fn(async () => undefined),
      remove: vi.fn(async () => {
        throw new AppError(502, 'justification_storage_delete_failed', 'fail')
      }),
      signedUrl: vi.fn(),
    }
    const repo = {
      getById: vi.fn(async () => ({
        id: ATT,
        empleadoId: EMP,
        archivoUrl: null,
        archivoStoragePath: null,
      })),
      setJustificationStoragePath: vi.fn(async () => {
        throw new AppError(500, 'db_failed', 'db')
      }),
    } as unknown as AttendanceRepository
    const service = createAttendanceJustificationsService(
      repo,
      storage as AttendanceJustificationsStorage,
      log,
    )
    const contentBase64 = Buffer.from('%PDF-1.7\n%%EOF').toString('base64')
    await expect(
      service.upload({
        attendanceId: ATT,
        fileName: 'cert.pdf',
        contentBase64,
        actorId: 'actor',
        requestId: 'req',
      }),
    ).rejects.toMatchObject({ code: 'db_failed' })
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'metadata_update.storage_delete_compensation',
        result: 'error',
        operation: 'attendance_justification.upload',
      }),
      'attendance justification compensation failed',
    )
  })
})

describe('phase 6C attendance export pagination', () => {
  it('fetchAllPages walks every page without loading on mount', async () => {
    const { fetchAllPages } = await import('../../../src/lib/api/fetch-all-pages.ts')
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [{ id: '1' }], total: 250 })
      .mockResolvedValueOnce({ items: [{ id: '2' }], total: 250 })
      .mockResolvedValueOnce({ items: [{ id: '3' }], total: 250 })
    const rows = await fetchAllPages(list, 100)
    expect(rows).toHaveLength(3)
    expect(list).toHaveBeenCalledTimes(3)
    expect(list.mock.calls.map((c) => c[0])).toEqual([
      { page: 1, pageSize: 100 },
      { page: 2, pageSize: 100 },
      { page: 3, pageSize: 100 },
    ])
  })
})

describe('phase 6C 6A/6B regression guards', () => {
  it('keeps ausencias export on-demand and backend justification path', () => {
    const ausencias = readFileSync(`${repoRoot}/src/app/ausencias/page.tsx`, 'utf8')
    const exportCmp = readFileSync(`${repoRoot}/src/components/ExportarAusencias.tsx`, 'utf8')
    expect(ausencias).not.toMatch(/allAttendance\s*\(/)
    expect(exportCmp).toContain('fetchAllPages')
    expect(exportCmp).not.toMatch(/storage\.from\(['"]justificaciones['"]\)/)
  })

  it('accepts catalog imports exactly at the shared row cap', () => {
    const rows = Array.from({ length: CATALOG_IMPORT_MAX_ROWS }, (_, i) => ({
      fila: i + 2,
      nombre: `A-${i}`,
    }))
    expect(articleImportBody.safeParse({ rows }).success).toBe(true)
  })

  it('still rejects mismatched justification file types from 6A', () => {
    const contentBase64 = Buffer.from('%PDF-1.7\n%%EOF').toString('base64')
    expect(() => decodeJustificationFile({ fileName: 'photo.jpg', contentBase64 })).toThrow(
      /extension does not match/i,
    )
  })
})
