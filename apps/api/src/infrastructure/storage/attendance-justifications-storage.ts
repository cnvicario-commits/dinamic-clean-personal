import { createClient } from '@supabase/supabase-js'
import type { Env } from '../../config/env.js'
import { AppError, serviceUnavailable } from '../../http/errors/app-error.js'

const BUCKET = 'justificaciones'

export type AttendanceJustificationsStorage = {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>
  remove(path: string): Promise<void>
  signedUrl(path: string, expiresIn: number): Promise<string>
}

export function createAttendanceJustificationsStorage(env: Env): AttendanceJustificationsStorage {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      upload: async () => {
        throw serviceUnavailable('Storage dependency unavailable')
      },
      remove: async () => {
        throw serviceUnavailable('Storage dependency unavailable')
      },
      signedUrl: async () => {
        throw serviceUnavailable('Storage dependency unavailable')
      },
    }
  }
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return {
    async upload(path, bytes, contentType) {
      const { error } = await client.storage.from(BUCKET).upload(path, bytes, {
        contentType,
        upsert: false,
      })
      if (error) throw new AppError(502, 'justification_storage_upload_failed', 'Justification storage upload failed')
    },
    async remove(path) {
      const { error } = await client.storage.from(BUCKET).remove([path])
      if (error) throw new AppError(502, 'justification_storage_delete_failed', 'Justification storage delete failed')
    },
    async signedUrl(path, expiresIn) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, expiresIn)
      if (error || !data) {
        throw new AppError(502, 'justification_storage_sign_failed', 'Justification download could not be prepared')
      }
      return data.signedUrl
    },
  }
}
