import { createClient } from '@supabase/supabase-js'
import type { Env } from '../../config/env.js'
import { AppError, serviceUnavailable } from '../../http/errors/app-error.js'

const BUCKET = 'presupuestos-clientes'
export type ClientQuotesStorage = {
  upload(path:string,bytes:Uint8Array):Promise<void>
  remove(path:string):Promise<void>
  signedUrl(path:string,expiresIn:number):Promise<string>
}

export function createClientQuotesStorage(env:Env):ClientQuotesStorage {
  if(!env.SUPABASE_SERVICE_ROLE_KEY) return {upload:async()=>{throw serviceUnavailable('Storage dependency unavailable')},remove:async()=>{throw serviceUnavailable('Storage dependency unavailable')},signedUrl:async()=>{throw serviceUnavailable('Storage dependency unavailable')}}
  const client=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  return {
    async upload(path,bytes){const {error}=await client.storage.from(BUCKET).upload(path,bytes,{contentType:'application/pdf',upsert:false});if(error)throw new AppError(502,'quote_storage_upload_failed','Quote storage upload failed')},
    async remove(path){const {error}=await client.storage.from(BUCKET).remove([path]);if(error)throw new AppError(502,'quote_storage_delete_failed','Quote storage delete failed')},
    async signedUrl(path,expiresIn){const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,expiresIn);if(error||!data)throw new AppError(502,'quote_storage_sign_failed','Quote download could not be prepared');return data.signedUrl},
  }
}
