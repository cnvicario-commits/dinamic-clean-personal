import { describe,expect,it,vi } from 'vitest'
import { createClientsRepository } from '../src/infrastructure/db/clients-repository.js'
import type { Db } from '../src/infrastructure/db/pool.js'

describe('clients repository transactions',()=>{
  it('rolls back client creation when initial address insert fails',async()=>{
    const queries:string[]=[]
    let hash=''
    const client={query:vi.fn(async(sql:string, params?: unknown[])=>{queries.push(sql);if(sql.includes('client_operation_idempotency')&&sql.includes('for update'))return{rows:[{payload_hash:hash,status:'PROCESSING',response:null}]};if(sql.startsWith('insert into public.client_operation_idempotency')){hash=String(params?.[2]??'');return{rows:[]}};if(sql.startsWith('insert into public.clientes'))return{rows:[{id:'c'}]};if(sql.includes('insert into public.cliente_domicilios'))throw new Error('address failure');return{rows:[]}}),release:vi.fn()}
    const db={pool:{connect:async()=>client},query:vi.fn()} as unknown as Db
    const repo=createClientsRepository(db)
    await expect(repo.create({nombre:'Cliente',cuit:null,personaContacto:null,codigoCostos:null,presupuesto4hs:0,presupuesto8hs:0,domicilio:'Calle',llevaInsumos:false},{actorId:'22222222-2222-4222-8222-222222222222',key:'client-1'})).rejects.toThrow('Client persistence failed')
    expect(queries).toContain('rollback')
    expect(queries).not.toContain('commit')
    expect(client.release).toHaveBeenCalledOnce()
  })
  it('serializes set-principal and commits both updates',async()=>{
    const queries:string[]=[]
    const client={query:vi.fn(async(sql:string)=>{queries.push(sql);if(sql.includes('select 1 from public.cliente_domicilios'))return{rows:[{exists:1}]};if(sql.includes('returning id, cliente_id'))return{rows:[{id:'a',es_principal:true}]};return{rows:[]}}),release:vi.fn()}
    const db={pool:{connect:async()=>client},query:vi.fn()} as unknown as Db
    await createClientsRepository(db).setPrincipal('c','a')
    expect(queries.some(q=>q.includes('pg_advisory_xact_lock'))).toBe(true)
    expect(queries).toContain('commit')
  })
})
