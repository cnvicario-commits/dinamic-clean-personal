import { randomUUID } from 'node:crypto'
import { AppError, badRequest, notFound } from '../../http/errors/app-error.js'
import type { AttendanceRepository } from '../../infrastructure/db/attendance-repository.js'
import type { AttendanceJustificationsStorage } from '../../infrastructure/storage/attendance-justifications-storage.js'

export const MAX_JUSTIFICATION_BYTES = 15 * 1024 * 1024
const SIGNED_TTL_SECONDS = 60
const PDF_MAGIC = Buffer.from('%PDF-')
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])
const GIF_MAGIC = Buffer.from('GIF8')
const WEBP_RIFF = Buffer.from('RIFF')

type FileKind = 'pdf' | 'jpeg' | 'png' | 'gif' | 'webp'
type DecodedFile = { name: string; bytes: Buffer; contentType: string }

const ALLOWED_EXT = /\.(pdf|jpe?g|png|webp|gif)$/i

const MIME: Record<FileKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

export function extensionKind(fileName: string): FileKind | null {
  if (/\.pdf$/i.test(fileName)) return 'pdf'
  if (/\.jpe?g$/i.test(fileName)) return 'jpeg'
  if (/\.png$/i.test(fileName)) return 'png'
  if (/\.webp$/i.test(fileName)) return 'webp'
  if (/\.gif$/i.test(fileName)) return 'gif'
  return null
}

export function detectBytesKind(bytes: Buffer): FileKind | null {
  if (bytes.subarray(0, PDF_MAGIC.length).compare(PDF_MAGIC) === 0) return 'pdf'
  if (bytes.subarray(0, JPEG_MAGIC.length).compare(JPEG_MAGIC) === 0) return 'jpeg'
  if (bytes.subarray(0, PNG_MAGIC.length).compare(PNG_MAGIC) === 0) return 'png'
  if (bytes.subarray(0, GIF_MAGIC.length).compare(GIF_MAGIC) === 0) return 'gif'
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, WEBP_RIFF.length).compare(WEBP_RIFF) === 0 &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

/** Extract object path from historical Supabase signed/authenticated Storage URLs for bucket justificaciones. */
export function parseLegacyJustificationObjectPath(archivoUrl: string): string | null {
  try {
    const url = new URL(archivoUrl)
    const marker = '/justificaciones/'
    const idx = url.pathname.indexOf(marker)
    if (idx === -1) return null
    const encoded = url.pathname.slice(idx + marker.length)
    const path = decodeURIComponent(encoded).replace(/^\/+/, '')
    if (!path || path.includes('..') || path.includes('\\')) return null
    return path
  } catch {
    return null
  }
}

export function decodeJustificationFile(input: { fileName: string; contentBase64: string }): DecodedFile {
  const name = input.fileName.trim()
  if (!name || name.length > 255) throw badRequest('Invalid file name')
  if (!ALLOWED_EXT.test(name)) {
    throw badRequest('Only PDF or image files (JPEG, PNG, WebP, GIF) are allowed')
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64)) throw badRequest('Invalid file encoding')
  const bytes = Buffer.from(input.contentBase64, 'base64')
  if (bytes.length === 0) throw badRequest('File is required')
  if (bytes.length > MAX_JUSTIFICATION_BYTES) {
    throw new AppError(413, 'justification_too_large', 'Justification file exceeds 15 MB')
  }
  const extKind = extensionKind(name)
  const bytesKind = detectBytesKind(bytes)
  if (!bytesKind) throw badRequest('File content does not match an allowed type')
  if (!extKind || extKind !== bytesKind) {
    throw badRequest('File extension does not match file content')
  }
  return { name, bytes, contentType: MIME[bytesKind] }
}

function safeName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120)
}

function displayFileName(storagePath: string | null, legacyUrl: string | null, fallback: string) {
  if (storagePath) {
    const base = storagePath.split('/').pop() ?? storagePath
    const idx = base.indexOf('_')
    return idx >= 0 ? base.slice(idx + 1) : base
  }
  if (legacyUrl) {
    const parsed = parseLegacyJustificationObjectPath(legacyUrl)
    if (parsed) {
      const base = parsed.split('/').pop() ?? parsed
      return base
    }
    try {
      const path = new URL(legacyUrl).pathname.split('/').pop()
      if (path) return decodeURIComponent(path)
    } catch {
      /* ignore */
    }
  }
  return fallback
}

type Logger = (data: Record<string, unknown>, message: string) => void

export function createAttendanceJustificationsService(
  repo: AttendanceRepository,
  storage: AttendanceJustificationsStorage,
  log: Logger,
) {
  return {
    async upload(input: {
      attendanceId: string
      fileName: string
      contentBase64: string
      actorId: string
      requestId: string
    }) {
      const row = await repo.getById(input.attendanceId)
      const file = decodeJustificationFile(input)
      const storagePath = `${row.empleadoId}/${randomUUID()}_${safeName(file.name)}`
      const previousPath = row.archivoStoragePath

      await storage.upload(storagePath, file.bytes, file.contentType)

      try {
        await repo.setJustificationStoragePath(input.attendanceId, storagePath)
      } catch (error) {
        try {
          await storage.remove(storagePath)
        } catch (compensationError) {
          log(
            {
              requestId: input.requestId,
              operation: 'attendance_justification.upload',
              attendanceId: input.attendanceId,
              storagePath,
              originalErrorCode: error instanceof AppError ? error.code : 'unknown',
              compensationErrorCode:
                compensationError instanceof AppError ? compensationError.code : 'unknown',
              result: 'error',
            },
            'attendance justification compensation failed',
          )
        }
        throw error
      }

      if (previousPath && previousPath !== storagePath) {
        try {
          await storage.remove(previousPath)
        } catch (removeError) {
          log(
            {
              requestId: input.requestId,
              operation: 'attendance_justification.upload',
              attendanceId: input.attendanceId,
              storagePath: previousPath,
              stage: 'replace_previous_object',
              errorCode: removeError instanceof AppError ? removeError.code : 'unknown',
              result: 'error',
            },
            'previous justification object could not be removed',
          )
        }
      }

      log(
        {
          requestId: input.requestId,
          actorUserId: input.actorId,
          action: 'attendance_justification.upload',
          resourceId: input.attendanceId,
          result: 'ok',
        },
        'attendance domain mutation',
      )
      return { attendanceId: input.attendanceId, hasJustification: true }
    },

    async download(attendanceId: string) {
      const row = await repo.getById(attendanceId)
      if (row.archivoStoragePath) {
        return {
          url: await storage.signedUrl(row.archivoStoragePath, SIGNED_TTL_SECONDS),
          expiresIn: SIGNED_TTL_SECONDS,
          fileName: displayFileName(row.archivoStoragePath, null, 'justificacion'),
          legacy: false,
        }
      }
      const legacyPath = row.archivoUrl ? parseLegacyJustificationObjectPath(row.archivoUrl) : null
      if (legacyPath) {
        return {
          url: await storage.signedUrl(legacyPath, SIGNED_TTL_SECONDS),
          expiresIn: SIGNED_TTL_SECONDS,
          fileName: displayFileName(legacyPath, null, 'justificacion'),
          legacy: true,
        }
      }
      if (row.archivoUrl) {
        return {
          url: row.archivoUrl,
          expiresIn: null,
          fileName: displayFileName(null, row.archivoUrl, 'justificacion'),
          legacy: true,
        }
      }
      throw notFound('Justification not found for attendance record')
    },

    async remove(input: { attendanceId: string; actorId: string; requestId: string }) {
      const cleared = await repo.clearJustification(input.attendanceId)
      const objectPath =
        cleared.archivoStoragePath ??
        (cleared.archivoUrl ? parseLegacyJustificationObjectPath(cleared.archivoUrl) : null)
      if (objectPath) {
        try {
          await storage.remove(objectPath)
        } catch (error) {
          try {
            await repo.restoreJustification(input.attendanceId, {
              storagePath: cleared.archivoStoragePath,
              archivoUrl: cleared.archivoUrl,
            })
          } catch (compensationError) {
            log(
              {
                requestId: input.requestId,
                operation: 'attendance_justification.delete',
                attendanceId: input.attendanceId,
                storagePath: objectPath,
                originalErrorCode: error instanceof AppError ? error.code : 'unknown',
                compensationErrorCode:
                  compensationError instanceof AppError ? compensationError.code : 'unknown',
                result: 'error',
              },
              'attendance justification compensation failed',
            )
          }
          throw error
        }
      }
      log(
        {
          requestId: input.requestId,
          actorUserId: input.actorId,
          action: 'attendance_justification.delete',
          resourceId: input.attendanceId,
          result: 'ok',
        },
        'attendance domain mutation',
      )
    },
  }
}
