'use client'

import { createClient } from '@/utils/supabase/client'
import { ApiClientError, createDinamicApiClient } from './generated'

export async function createAuthenticatedBrowserApiClient() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL
  if (!baseUrl) throw new ApiClientError('NEXT_PUBLIC_API_URL is not configured', 0, null)
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new ApiClientError('Sesión no disponible', 401, null)
  return createDinamicApiClient({ baseUrl, accessToken: session.access_token })
}
