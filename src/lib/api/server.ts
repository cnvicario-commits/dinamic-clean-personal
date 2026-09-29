import 'server-only'
import { createClient } from '@/utils/supabase/server'
import { ApiClientError, createDinamicApiClient } from './generated'

export async function createAuthenticatedServerApiClient() {
  const baseUrl=process.env.NEXT_PUBLIC_API_URL
  if(!baseUrl)throw new ApiClientError('NEXT_PUBLIC_API_URL is not configured',0,null)
  const supabase=await createClient()
  const {data:{user},error:userError}=await supabase.auth.getUser()
  if(userError||!user)throw new ApiClientError('Sesión no disponible',401,null)
  const {data:{session}}=await supabase.auth.getSession()
  if(!session?.access_token)throw new ApiClientError('Sesión no disponible',401,null)
  return createDinamicApiClient({baseUrl,accessToken:session.access_token})
}
