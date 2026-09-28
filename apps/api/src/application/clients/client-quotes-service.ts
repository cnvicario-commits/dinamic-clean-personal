import { randomUUID } from 'node:crypto'
import { AppError, badRequest } from '../../http/errors/app-error.js'
import type { ClientsRepository } from '../../infrastructure/db/clients-repository.js'
import type { ClientQuotesStorage } from '../../infrastructure/storage/client-quotes-storage.js'

export const MAX_QUOTE_BYTES=15*1024*1024
const PDF_MAGIC=Buffer.from('%PDF-')
export function decodePdf(input:{fileName:string;contentBase64:string}){
  const name=input.fileName.trim()
  if(!name||name.length>255)throw badRequest('Invalid file name')
  if(!/\.pdf$/i.test(name))throw badRequest('Only PDF files are allowed')
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64))throw badRequest('Invalid file encoding')
  const bytes=Buffer.from(input.contentBase64,'base64')
  if(bytes.length===0)throw badRequest('File is required')
  if(bytes.length>MAX_QUOTE_BYTES)throw new AppError(413,'quote_too_large','Quote file exceeds 15 MB')
  if(bytes.subarray(0,PDF_MAGIC.length).compare(PDF_MAGIC)!==0)throw badRequest('File content is not a PDF')
  return {name,bytes}
}
function safeName(name:string){return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-120)}
export function createClientQuotesService(repo:ClientsRepository,storage:ClientQuotesStorage,log:(data:Record<string,unknown>,message:string)=>void){
  return {
    list:(clientId:string)=>repo.listQuotes(clientId),
    async upload(input:{clientId:string;fileName:string;contentBase64:string;actorId:string;requestId:string}){
      await repo.get(input.clientId)
      const file=decodePdf(input)
      const path=`${input.clientId}/${randomUUID()}_${safeName(file.name)}`
      await storage.upload(path,file.bytes)
      try{const record=await repo.insertQuote({clientId:input.clientId,storagePath:path,fileName:file.name,actorId:input.actorId});log({requestId:input.requestId,actorUserId:input.actorId,action:'client_quote.upload',resourceId:(record as {id?:unknown}).id,result:'ok'},'client domain mutation');return record}
      catch(error){try{await storage.remove(path)}catch(compensationError){log({requestId:input.requestId,actorUserId:input.actorId,action:'client_quote.upload_compensation',storagePath:path,result:'error',err:compensationError},'client quote compensation failed')}throw error}
    },
    async download(clientId:string,quoteId:string){const quote=await repo.getQuote(clientId,quoteId);return {url:await storage.signedUrl(quote.storage_path,60),expiresIn:60,fileName:quote.nombre_archivo}},
    async remove(input:{clientId:string;quoteId:string;actorId:string;requestId:string}){
      const quote=await repo.deleteQuote(input.clientId,input.quoteId)
      try{await storage.remove(quote.storage_path)}catch(error){try{await repo.restoreQuote({id:quote.id,clientId:input.clientId,storagePath:quote.storage_path,fileName:quote.nombre_archivo,actorId:quote.subido_por??input.actorId,createdAt:quote.created_at})}catch(compensationError){log({requestId:input.requestId,actorUserId:input.actorId,action:'client_quote.delete_compensation',resourceId:quote.id,result:'error',err:compensationError},'client quote compensation failed')}throw error}
      log({requestId:input.requestId,actorUserId:input.actorId,action:'client_quote.delete',resourceId:quote.id,result:'ok'},'client domain mutation')
    }
  }
}
