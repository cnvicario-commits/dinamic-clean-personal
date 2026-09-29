/** Opt-in real PostgreSQL idempotency test. Temporary client is removed with the local admin connection. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import type { Db } from '../src/infrastructure/db/pool.js'
import { createClientsRepository } from '../src/infrastructure/db/clients-repository.js'
import { createClientQuotesService } from '../src/application/clients/client-quotes-service.js'
import { createClientQuotesStorage } from '../src/infrastructure/storage/client-quotes-storage.js'
import type { Env } from '../src/config/env.js'

const enabled=process.env.RUN_SUPABASE_INTEGRATION==='1'&&Boolean(process.env.DATABASE_URL)&&Boolean(process.env.PHASE4A_ADMIN_DATABASE_URL)&&Boolean(process.env.SUPABASE_URL)&&Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
const {Pool}=pg
describe.skipIf(!enabled)('Phase 4A quote idempotency real PostgreSQL',()=>{
  let apiPool:pg.Pool
  let adminPool:pg.Pool
  let repo:ReturnType<typeof createClientsRepository>
  let clientId=''
  let actorId=''
  beforeAll(async()=>{
    apiPool=new Pool({connectionString:process.env.DATABASE_URL})
    adminPool=new Pool({connectionString:process.env.PHASE4A_ADMIN_DATABASE_URL})
    const actor=await adminPool.query<{id:string}>('select id from public.perfiles order by id limit 1')
    if(!actor.rows[0])throw new Error('Phase 4A integration requires one existing profile')
    actorId=actor.rows[0].id
    const fixture=await adminPool.query<{id:string}>(`insert into public.clientes(nombre,presupuesto_4hs,presupuesto_8hs,lleva_insumos) values($1,0,0,false) returning id`,[`Phase4A idempotency ${crypto.randomUUID()}`])
    clientId=fixture.rows[0]!.id
    const db={pool:apiPool,query:apiPool.query.bind(apiPool),close:async()=>apiPool.end(),isReady:async()=>true,checkPhase2dProfilesCapabilities:async()=>({ok:true}),checkPhase3aCapabilities:async()=>({ok:true,currentUser:'dinamic_api'})} as unknown as Db
    repo=createClientsRepository(db)
  })
  afterAll(async()=>{if(clientId)await adminPool.query('delete from public.clientes where id=$1',[clientId]);await apiPool?.end();await adminPool?.end()})
  it('persists one completed record under concurrent same-key claims and replays it',async()=>{
    const base={clientId,actorId,idempotencyKey:`key-${crypto.randomUUID()}`,payloadHash:'a'.repeat(64)}
    const [a,b]=await Promise.all([repo.claimQuoteUpload({...base,storagePath:`${clientId}/a.pdf`}),repo.claimQuoteUpload({...base,storagePath:`${clientId}/b.pdf`})])
    const owner=[a,b].find(x=>x.state==='owner')
    expect(owner).toMatchObject({state:'owner'})
    expect([a,b].filter(x=>x.state==='owner')).toHaveLength(1)
    const stored=await repo.insertQuoteAndCompleteUpload({...base,storagePath:(owner as {storagePath:string}).storagePath,fileName:'x.pdf'})
    const replay=await repo.claimQuoteUpload({...base,storagePath:`${clientId}/ignored.pdf`})
    expect(replay).toMatchObject({state:'completed',quoteId:stored.id})
    const persisted=await adminPool.query<{quotes:string;claims:string;status:string}>(`select (select count(*)::text from public.cliente_presupuestos where cliente_id=$1) as quotes,(select count(*)::text from public.cliente_presupuesto_upload_idempotency where cliente_id=$1 and actor_id=$2 and idempotency_key=$3) as claims,(select status from public.cliente_presupuesto_upload_idempotency where cliente_id=$1 and actor_id=$2 and idempotency_key=$3) as status`,[clientId,actorId,base.idempotencyKey])
    expect(persisted.rows[0]).toMatchObject({quotes:'1',claims:'1',status:'COMPLETED'})
    await expect(repo.claimQuoteUpload({...base,payloadHash:'b'.repeat(64),storagePath:`${clientId}/other.pdf`})).rejects.toMatchObject({status:409,code:'idempotency_key_payload_mismatch'})
  }, 20_000)
  it('uploads one real private object and one metadata row across a lost-response retry',async()=>{
    const storage=createClientQuotesStorage({SUPABASE_URL:process.env.SUPABASE_URL!,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY!} as Env)
    const service=createClientQuotesService(repo,storage,()=>undefined)
    const key=`storage-${crypto.randomUUID()}`
    const input={clientId,fileName:'real.pdf',contentBase64:Buffer.from('%PDF-1.7\n%%EOF').toString('base64'),actorId,requestId:'integration',idempotencyKey:key}
    const first=await service.upload(input)
    const retry=await service.upload(input)
    expect(retry).toMatchObject({replayed:true,record:{id:first.record.id}})
    const persisted=await adminPool.query<{rows:string;objects:string}>(`select (select count(*)::text from public.cliente_presupuestos where id=$1) as rows,(select count(*)::text from storage.objects where bucket_id='presupuestos-clientes' and name=(select storage_path from public.cliente_presupuestos where id=$1)) as objects`,[first.record.id])
    expect(persisted.rows[0]).toMatchObject({rows:'1',objects:'1'})
    await service.remove({clientId,quoteId:first.record.id,actorId,requestId:'integration-cleanup'})
    const removed=await adminPool.query<{rows:string;objects:string}>(`select (select count(*)::text from public.cliente_presupuestos where id=$1) as rows,(select count(*)::text from storage.objects where bucket_id='presupuestos-clientes' and name like $2) as objects`,[first.record.id,`${clientId}/%`])
    expect(removed.rows[0]).toMatchObject({rows:'0',objects:'0'})
  }, 20_000)
})
