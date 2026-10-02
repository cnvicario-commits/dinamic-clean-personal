import { describe, expect, it, vi } from 'vitest'
import {
  createAttendanceJustificationsService,
  decodeJustificationFile,
  detectBytesKind,
  extensionKind,
  parseLegacyJustificationObjectPath,
} from '../src/application/attendance/attendance-justifications-service.js'
import type { AttendanceRepository } from '../src/infrastructure/db/attendance-repository.js'
import type { AttendanceJustificationsStorage } from '../src/infrastructure/storage/attendance-justifications-storage.js'
import { AppError } from '../src/http/errors/app-error.js'

const ATT = '11111111-1111-4111-8111-111111111111'
const EMP = '22222222-2222-4222-8222-222222222222'
const PREVIOUS_PATH = `${EMP}/11111111-1111-4111-8111-111111111111_cert.pdf`

function repo(overrides: Partial<AttendanceRepository> = {}): AttendanceRepository {
  return {
    list: vi.fn(),
    upsert: vi.fn(),
    listCodes: vi.fn(),
    getById: vi.fn(async () => ({
      id: ATT,
      empleadoId: EMP,
      archivoUrl: null,
      archivoStoragePath: null,
    })),
    setJustificationStoragePath: vi.fn(async () => undefined),
    clearJustification: vi.fn(async () => ({
      archivoUrl: null,
      archivoStoragePath: PREVIOUS_PATH,
    })),
    restoreJustification: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as AttendanceRepository
}

function storageMock(): AttendanceJustificationsStorage & {
  upload: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  signedUrl: ReturnType<typeof vi.fn>
} {
  return {
    upload: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    signedUrl: vi.fn(async () => 'https://signed.example/justification'),
  }
}

describe('decodeJustificationFile', () => {
  it('accepts PDF when extension and magic match', () => {
    const contentBase64 = Buffer.from('%PDF-1.7\n%%EOF').toString('base64')
    expect(decodeJustificationFile({ fileName: 'cert.pdf', contentBase64 }).contentType).toBe(
      'application/pdf',
    )
  })

  it('rejects .jpg extension with PDF bytes', () => {
    const contentBase64 = Buffer.from('%PDF-1.7\n%%EOF').toString('base64')
    expect(() => decodeJustificationFile({ fileName: 'photo.jpg', contentBase64 })).toThrow(
      /extension does not match/i,
    )
  })

  it('rejects .pdf extension with PNG bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(() =>
      decodeJustificationFile({ fileName: 'x.pdf', contentBase64: png.toString('base64') }),
    ).toThrow(/extension does not match|does not match an allowed type/i)
  })

  it('rejects .gif extension with non-GIF bytes', () => {
    expect(() =>
      decodeJustificationFile({
        fileName: 'x.gif',
        contentBase64: Buffer.from('not-a-gif').toString('base64'),
      }),
    ).toThrow(/does not match/i)
  })

  it('rejects unsupported extensions', () => {
    expect(() =>
      decodeJustificationFile({ fileName: 'x.exe', contentBase64: Buffer.from('MZ').toString('base64') }),
    ).toThrow(/allowed/)
  })

  it('rejects payloads over 15 MB', () => {
    const big = Buffer.alloc(15 * 1024 * 1024 + 1, 0)
    big.write('%PDF', 0)
    expect(() =>
      decodeJustificationFile({ fileName: 'big.pdf', contentBase64: big.toString('base64') }),
    ).toThrow(/15 MB|justification_too_large/i)
  })
})

describe('legacy object path parsing', () => {
  it('extracts flat path from Supabase sign URL (historical browser upload shape)', () => {
    const empleadoId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    const objectPath = `${empleadoId}_1710000000000_cert.pdf`
    const url = `https://project.supabase.co/storage/v1/object/sign/justificaciones/${encodeURIComponent(objectPath)}?token=abc`
    expect(parseLegacyJustificationObjectPath(url)).toBe(objectPath)
  })

  it('returns null when bucket segment is absent', () => {
    expect(parseLegacyJustificationObjectPath('https://example.com/other/file.pdf')).toBeNull()
  })
})

describe('attendance justifications service', () => {
  it('uploads, persists path and signs on download', async () => {
    const storage = storageMock()
    const r = repo({
      getById: vi
        .fn()
        .mockResolvedValueOnce({
          id: ATT,
          empleadoId: EMP,
          archivoUrl: null,
          archivoStoragePath: null,
        })
        .mockResolvedValueOnce({
          id: ATT,
          empleadoId: EMP,
          archivoUrl: null,
          archivoStoragePath: `${EMP}/just.pdf`,
        }),
    })
    const service = createAttendanceJustificationsService(r, storage, () => undefined)
    const contentBase64 = Buffer.from('%PDF-1.7\n%%EOF').toString('base64')
    await service.upload({
      attendanceId: ATT,
      fileName: 'just.pdf',
      contentBase64,
      actorId: 'actor',
      requestId: 'req',
    })
    expect(storage.upload).toHaveBeenCalledOnce()
    expect(r.setJustificationStoragePath).toHaveBeenCalledOnce()
    const download = await service.download(ATT)
    expect(download.url).toBe('https://signed.example/justification')
    expect(download.legacy).toBe(false)
  })

  it('re-signs legacy rows when object path is embedded in archivo_url', async () => {
    const storage = storageMock()
    const legacyPath = `${EMP}_123_photo.jpg`
    const legacy = `https://project.supabase.co/storage/v1/object/sign/justificaciones/${legacyPath}?token=old`
    const r = repo({
      getById: vi.fn(async () => ({
        id: ATT,
        empleadoId: EMP,
        archivoUrl: legacy,
        archivoStoragePath: null,
      })),
    })
    const service = createAttendanceJustificationsService(r, storage, () => undefined)
    const download = await service.download(ATT)
    expect(storage.signedUrl).toHaveBeenCalledWith(legacyPath, 60)
    expect(download.legacy).toBe(true)
    expect(download.expiresIn).toBe(60)
  })

  it('falls back to persisted legacy URL when path cannot be parsed', async () => {
    const storage = storageMock()
    const legacy = 'https://cdn.example.com/opaque-token-only'
    const r = repo({
      getById: vi.fn(async () => ({
        id: ATT,
        empleadoId: EMP,
        archivoUrl: legacy,
        archivoStoragePath: null,
      })),
    })
    const service = createAttendanceJustificationsService(r, storage, () => undefined)
    const download = await service.download(ATT)
    expect(download.url).toBe(legacy)
    expect(download.expiresIn).toBeNull()
    expect(storage.signedUrl).not.toHaveBeenCalled()
  })

  it('passes the pre-clear storage path to storage.remove on delete (modern row)', async () => {
    const storage = storageMock()
    const r = repo()
    const service = createAttendanceJustificationsService(r, storage, () => undefined)
    await service.remove({ attendanceId: ATT, actorId: 'actor', requestId: 'req' })
    expect(storage.remove).toHaveBeenCalledOnce()
    expect(storage.remove).toHaveBeenCalledWith(PREVIOUS_PATH)
  })

  it('removes reconstructed object path for parseable legacy Supabase URL', async () => {
    const storage = storageMock()
    const legacyPath = `${EMP}_123_cert.pdf`
    const legacyUrl = `https://project.supabase.co/storage/v1/object/sign/justificaciones/${legacyPath}?token=old`
    const r = repo({
      clearJustification: vi.fn(async () => ({
        archivoUrl: legacyUrl,
        archivoStoragePath: null,
      })),
    })
    const service = createAttendanceJustificationsService(r, storage, () => undefined)
    await service.remove({ attendanceId: ATT, actorId: 'actor', requestId: 'req' })
    expect(storage.remove).toHaveBeenCalledOnce()
    expect(storage.remove).toHaveBeenCalledWith(legacyPath)
  })

  it('restores metadata when storage delete fails', async () => {
    const storage = storageMock()
    storage.remove.mockRejectedValueOnce(new AppError(502, 'justification_storage_delete_failed', 'fail'))
    const r = repo({
      clearJustification: vi.fn(async () => ({
        archivoUrl: 'https://legacy.example/x',
        archivoStoragePath: PREVIOUS_PATH,
      })),
    })
    const service = createAttendanceJustificationsService(r, storage, () => undefined)
    await expect(
      service.remove({ attendanceId: ATT, actorId: 'actor', requestId: 'req' }),
    ).rejects.toMatchObject({ status: 502 })
    expect(r.restoreJustification).toHaveBeenCalledWith(ATT, {
      storagePath: PREVIOUS_PATH,
      archivoUrl: 'https://legacy.example/x',
    })
  })

  it('restores original legacy metadata when delete of parseable legacy object fails', async () => {
    const storage = storageMock()
    storage.remove.mockRejectedValueOnce(new AppError(502, 'justification_storage_delete_failed', 'fail'))
    const legacyPath = `${EMP}_456_photo.jpg`
    const legacyUrl = `https://project.supabase.co/storage/v1/object/sign/justificaciones/${legacyPath}?token=old`
    const r = repo({
      clearJustification: vi.fn(async () => ({
        archivoUrl: legacyUrl,
        archivoStoragePath: null,
      })),
    })
    const service = createAttendanceJustificationsService(r, storage, () => undefined)
    await expect(
      service.remove({ attendanceId: ATT, actorId: 'actor', requestId: 'req' }),
    ).rejects.toMatchObject({ status: 502 })
    expect(storage.remove).toHaveBeenCalledWith(legacyPath)
    expect(r.restoreJustification).toHaveBeenCalledWith(ATT, {
      storagePath: null,
      archivoUrl: legacyUrl,
    })
  })

  it('clears opaque legacy URL rows without calling storage.remove', async () => {
    const storage = storageMock()
    const r = repo({
      clearJustification: vi.fn(async () => ({
        archivoUrl: 'https://legacy.example/x',
        archivoStoragePath: null,
      })),
    })
    const service = createAttendanceJustificationsService(r, storage, () => undefined)
    await service.remove({ attendanceId: ATT, actorId: 'actor', requestId: 'req' })
    expect(storage.remove).not.toHaveBeenCalled()
  })
})

describe('helpers', () => {
  it('maps extensions and magic consistently', () => {
    expect(extensionKind('a.JPG')).toBe('jpeg')
    expect(detectBytesKind(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('jpeg')
  })
})
