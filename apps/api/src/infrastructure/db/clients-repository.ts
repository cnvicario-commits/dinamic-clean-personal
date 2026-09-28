import type pg from 'pg'
import type { Db } from './pool.js'
import { AppError, badRequest, notFound } from '../../http/errors/app-error.js'
import type { CreateAddressBody, CreateClientBody, UpdateAddressBody, UpdateClientBody } from '../../http/schemas/clients.js'

const CLIENT_FIELDS = `id, nombre, cuit, persona_contacto, codigo_costos,
  presupuesto_4hs, presupuesto_8hs, domicilio, lleva_insumos, activo, created_at`
const ADDRESS_FIELDS = `id, cliente_id, alias, direccion, es_principal, activo,
  horario_atencion, supervisor_id, created_at`

function persistenceError(error: unknown): AppError {
  if (error instanceof AppError) return error
  const code = (error as { code?: unknown })?.code
  if (code === '23505') return new AppError(409, 'client_conflict', 'Client data conflicts with an existing record')
  if (code === '23503') return badRequest('Related client data does not exist')
  return new AppError(502, 'client_persistence_failed', 'Client persistence failed')
}

export function createClientsRepository(db: Db) {
  async function requireClient(id: string, client?: pg.PoolClient) {
    const result = client
      ? await client.query(`select ${CLIENT_FIELDS} from public.clientes where id = $1`, [id])
      : await db.query(`select ${CLIENT_FIELDS} from public.clientes where id = $1`, [id])
    const row = result.rows[0]
    if (!row) throw notFound('Client not found')
    return row
  }
  async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await db.pool.connect()
    try { await client.query('begin'); const value = await fn(client); await client.query('commit'); return value }
    catch (error) { await client.query('rollback'); throw persistenceError(error) }
    finally { client.release() }
  }
  return {
    async list() { return (await db.query(`select ${CLIENT_FIELDS} from public.clientes order by nombre, id`)).rows },
    get: requireClient,
    async detail(id: string) {
      const [client, addresses, quotes] = await Promise.all([
        requireClient(id),
        db.query(`select ${ADDRESS_FIELDS} from public.cliente_domicilios where cliente_id=$1 order by es_principal desc, alias, id`, [id]),
        db.query(`select cp.id,cp.cliente_id,cp.nombre_archivo,cp.created_at,cp.subido_por,p.nombre_completo as subido_por_nombre from public.cliente_presupuestos cp left join public.perfiles p on p.id=cp.subido_por where cp.cliente_id=$1 order by cp.created_at desc,cp.id`, [id]),
      ])
      return { client, addresses: addresses.rows, quotes: quotes.rows }
    },
    async create(input: CreateClientBody) {
      return transaction(async (client) => {
        const result = await client.query(`insert into public.clientes (nombre,cuit,persona_contacto,codigo_costos,presupuesto_4hs,presupuesto_8hs,domicilio,lleva_insumos) values($1,$2,$3,$4,$5,$6,$7,$8) returning ${CLIENT_FIELDS}`,[input.nombre,input.cuit,input.personaContacto,input.codigoCostos,input.presupuesto4hs,input.presupuesto8hs,input.domicilio,input.llevaInsumos])
        const row = result.rows[0]
        if (!row) throw new AppError(502, 'client_create_empty', 'Client persistence failed')
        if (input.domicilio) await client.query(`insert into public.cliente_domicilios (cliente_id,alias,direccion,es_principal,activo) values($1,'Principal',$2,true,true)`, [row.id,input.domicilio])
        return row
      })
    },
    async update(id: string, input: UpdateClientBody) {
      const values = Object.entries({nombre:input.nombre,cuit:input.cuit,persona_contacto:input.personaContacto,codigo_costos:input.codigoCostos,presupuesto_4hs:input.presupuesto4hs,presupuesto_8hs:input.presupuesto8hs,domicilio:input.domicilio,lleva_insumos:input.llevaInsumos,activo:input.activo}).filter(([,v])=>v!==undefined)
      try { const result=await db.query(`update public.clientes set ${values.map(([key],i)=>`${key}=$${i+2}`).join(', ')} where id=$1 returning ${CLIENT_FIELDS}`,[id,...values.map(([,v])=>v)]); if(!result.rows[0])throw notFound('Client not found'); return result.rows[0] } catch(error){throw persistenceError(error)}
    },
    async addresses(clientId: string) { await requireClient(clientId); return (await db.query(`select ${ADDRESS_FIELDS} from public.cliente_domicilios where cliente_id=$1 order by es_principal desc,alias,id`,[clientId])).rows },
    async createAddress(clientId: string, input: CreateAddressBody) {
      return transaction(async (client)=>{ await requireClient(clientId,client); if(input.esPrincipal){await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[clientId]);await client.query('update public.cliente_domicilios set es_principal=false where cliente_id=$1',[clientId])} return (await client.query(`insert into public.cliente_domicilios(cliente_id,alias,direccion,horario_atencion,es_principal,activo) values($1,$2,$3,$4,$5,true) returning ${ADDRESS_FIELDS}`,[clientId,input.alias,input.direccion,input.horarioAtencion,input.esPrincipal])).rows[0] })
    },
    async updateAddress(clientId:string,addressId:string,input:UpdateAddressBody){return transaction(async(client)=>{if(input.esPrincipal===true)await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[clientId]);const current=await client.query('select 1 from public.cliente_domicilios where id=$1 and cliente_id=$2 for update',[addressId,clientId]);if(!current.rows[0])throw notFound('Client address not found');if(input.esPrincipal===true)await client.query('update public.cliente_domicilios set es_principal=false where cliente_id=$1 and id<>$2',[clientId,addressId]);const values=Object.entries({alias:input.alias,direccion:input.direccion,horario_atencion:input.horarioAtencion,es_principal:input.esPrincipal}).filter(([,v])=>v!==undefined);return(await client.query(`update public.cliente_domicilios set ${values.map(([key],i)=>`${key}=$${i+3}`).join(', ')} where id=$1 and cliente_id=$2 returning ${ADDRESS_FIELDS}`,[addressId,clientId,...values.map(([,v])=>v)])).rows[0]})},
    async setAddressStatus(clientId:string,addressId:string,activo:boolean){const result=await db.query(`update public.cliente_domicilios set activo=$3,es_principal=case when $3 then es_principal else false end where id=$1 and cliente_id=$2 returning ${ADDRESS_FIELDS}`,[addressId,clientId,activo]);if(!result.rows[0])throw notFound('Client address not found');return result.rows[0]},
    async setPrincipal(clientId:string,addressId:string){return transaction(async(client)=>{await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[clientId]);const exists=await client.query('select 1 from public.cliente_domicilios where id=$1 and cliente_id=$2 and activo=true for update',[addressId,clientId]);if(!exists.rows[0])throw notFound('Active client address not found');await client.query('update public.cliente_domicilios set es_principal=false where cliente_id=$1 and id<>$2',[clientId,addressId]);return(await client.query(`update public.cliente_domicilios set es_principal=true where id=$1 and cliente_id=$2 returning ${ADDRESS_FIELDS}`,[addressId,clientId])).rows[0]})},
    async listQuotes(clientId:string){await requireClient(clientId);return(await db.query('select cp.id,cp.cliente_id,cp.nombre_archivo,cp.subido_por,cp.created_at,p.nombre_completo as subido_por_nombre from public.cliente_presupuestos cp left join public.perfiles p on p.id=cp.subido_por where cp.cliente_id=$1 order by cp.created_at desc,cp.id',[clientId])).rows},
    async insertQuote(input:{clientId:string;storagePath:string;fileName:string;actorId:string}){const r=await db.query('insert into public.cliente_presupuestos(cliente_id,storage_path,nombre_archivo,subido_por) values($1,$2,$3,$4) returning id,cliente_id,nombre_archivo,subido_por,created_at',[input.clientId,input.storagePath,input.fileName,input.actorId]);return r.rows[0]},
    async getQuote(clientId:string,quoteId:string){const r=await db.query('select id,cliente_id,nombre_archivo,storage_path,subido_por,created_at from public.cliente_presupuestos where id=$1 and cliente_id=$2',[quoteId,clientId]);if(!r.rows[0])throw notFound('Client quote not found');return r.rows[0] as {id:string;storage_path:string;nombre_archivo:string;subido_por:string}},
    async deleteQuote(clientId:string,quoteId:string){const r=await db.query('delete from public.cliente_presupuestos where id=$1 and cliente_id=$2 returning id,storage_path,nombre_archivo,subido_por,created_at',[quoteId,clientId]);if(!r.rows[0])throw notFound('Client quote not found');return r.rows[0] as {id:string;storage_path:string;nombre_archivo:string;subido_por:string;created_at:string}},
    async restoreQuote(input:{id:string;clientId:string;storagePath:string;fileName:string;actorId:string;createdAt:string}){await db.query('insert into public.cliente_presupuestos(id,cliente_id,storage_path,nombre_archivo,subido_por,created_at) values($1,$2,$3,$4,$5,$6) on conflict(id) do nothing',[input.id,input.clientId,input.storagePath,input.fileName,input.actorId,input.createdAt])},
  }
}
export type ClientsRepository=ReturnType<typeof createClientsRepository>
