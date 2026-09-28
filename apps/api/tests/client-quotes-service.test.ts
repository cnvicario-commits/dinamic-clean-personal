import { describe, expect, it, vi } from 'vitest'
import { createClientQuotesService, decodePdf, MAX_QUOTE_BYTES } from '../src/application/clients/client-quotes-service.js'
import type { ClientsRepository } from '../src/infrastructure/db/clients-repository.js'
import type { ClientQuotesStorage } from '../src/infrastructure/storage/client-quotes-storage.js'
import { notFound } from '../src/http/errors/app-error.js'

const PDF=Buffer.from('%PDF-1.7\n%%EOF').toString('base64')
function setup(overrides:{insertFails?:boolean;uploadFails?:boolean;removeFails?:boolean;foreignQuote?:boolean}={}){
  const repo={
    get:vi.fn(async()=>({id:'c'}),), listQuotes:vi.fn(async()=>[]),
    insertQuote:vi.fn(async()=>{if(overrides.insertFails)throw new Error('db');return{id:'q'}}),
    getQuote:vi.fn(async()=>{if(overrides.foreignQuote)throw notFound('Client quote not found');return{id:'q',storage_path:'c/x.pdf',nombre_archivo:'x.pdf',subido_por:'u'}}),
    deleteQuote:vi.fn(async()=>({id:'q',storage_path:'c/x.pdf',nombre_archivo:'x.pdf',subido_por:'u',created_at:'2026-01-01T00:00:00Z'})),
    restoreQuote:vi.fn(async()=>undefined),
  } as unknown as ClientsRepository
  const storage:ClientQuotesStorage={upload:vi.fn(async()=>{if(overrides.uploadFails)throw new Error('storage upload')}),remove:vi.fn(async()=>{if(overrides.removeFails)throw new Error('storage')}),signedUrl:vi.fn(async()=> 'https://signed.example/x')}
  const log=vi.fn()
  return {repo,storage,log,service:createClientQuotesService(repo,storage,log)}
}

describe('client quote lifecycle',()=>{
  it('validates PDF magic and size',()=>{expect(decodePdf({fileName:'x.pdf',contentBase64:PDF}).bytes.length).toBeGreaterThan(0);expect(()=>decodePdf({fileName:'x.pdf',contentBase64:Buffer.from('no').toString('base64')})).toThrow('not a PDF');expect(()=>decodePdf({fileName:'x.txt',contentBase64:PDF})).toThrow('Only PDF');const oversized=Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(MAX_QUOTE_BYTES)]).toString('base64');expect(()=>decodePdf({fileName:'x.pdf',contentBase64:oversized})).toThrow('exceeds 15 MB')})
  it('uploads storage before metadata',async()=>{const x=setup();await x.service.upload({clientId:'c',fileName:'x.pdf',contentBase64:PDF,actorId:'u',requestId:'r'});expect(x.storage.upload).toHaveBeenCalledOnce();expect((x.repo as never as {insertQuote:ReturnType<typeof vi.fn>}).insertQuote).toHaveBeenCalledOnce()})
  it('does not create metadata when storage upload fails',async()=>{const x=setup({uploadFails:true});await expect(x.service.upload({clientId:'c',fileName:'x.pdf',contentBase64:PDF,actorId:'u',requestId:'r'})).rejects.toThrow('storage upload');expect((x.repo as never as {insertQuote:ReturnType<typeof vi.fn>}).insertQuote).not.toHaveBeenCalled()})
  it('removes object when metadata insert fails',async()=>{const x=setup({insertFails:true});await expect(x.service.upload({clientId:'c',fileName:'x.pdf',contentBase64:PDF,actorId:'u',requestId:'r'})).rejects.toThrow('db');expect(x.storage.remove).toHaveBeenCalledOnce()})
  it('returns short-lived signed download',async()=>{const x=setup();await expect(x.service.download('c','q')).resolves.toMatchObject({url:'https://signed.example/x',expiresIn:60})})
  it('does not sign a quote outside the requested client',async()=>{const x=setup({foreignQuote:true});await expect(x.service.download('other-client','q')).rejects.toThrow('Client quote not found');expect(x.storage.signedUrl).not.toHaveBeenCalled()})
  it('restores metadata when storage delete fails',async()=>{const x=setup({removeFails:true});await expect(x.service.remove({clientId:'c',quoteId:'q',actorId:'u',requestId:'r'})).rejects.toThrow('storage');expect((x.repo as never as {restoreQuote:ReturnType<typeof vi.fn>}).restoreQuote).toHaveBeenCalledOnce()})
})
