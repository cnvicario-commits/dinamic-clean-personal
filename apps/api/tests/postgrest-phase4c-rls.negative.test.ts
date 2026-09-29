import { afterAll,beforeAll,describe,expect,it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL
const anon=process.env.SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service=process.env.SUPABASE_SERVICE_ROLE_KEY
const ready=Boolean(process.env.RUN_SUPABASE_INTEGRATION==='1'&&url&&anon&&service)
const nil='00000000-0000-0000-0000-000000000000'
describe.skipIf(!ready)('Phase 4C direct browser bypass negative',()=>{
 const users:Array<{id:string;role:string;token:string}>=[];const password=`P4c-${crypto.randomUUID()}!Aa1`
 beforeAll(async()=>{const admin=createClient(url!,service!,{auth:{persistSession:false}});for(const role of ['admin','gerente','compras']){const email=`phase4c-${role}-${crypto.randomUUID()}@example.invalid`;const created=await admin.auth.admin.createUser({email,password,email_confirm:true});if(created.error||!created.data.user)throw created.error??new Error('Auth user not created');const profile=await admin.from('perfiles').upsert({id:created.data.user.id,nombre_completo:`Phase 4C ${role}`,rol:role});if(profile.error)throw profile.error;const browser=createClient(url!,anon!,{auth:{persistSession:false}});const signed=await browser.auth.signInWithPassword({email,password});if(signed.error||!signed.data.session)throw signed.error??new Error('Session not created');users.push({id:created.data.user.id,role,token:signed.data.session.access_token})}},30_000)
 afterAll(async()=>{if(!ready)return;const admin=createClient(url!,service!,{auth:{persistSession:false}});for(const user of users)await admin.auth.admin.deleteUser(user.id)},30_000)
 const mutations=[
  ['POST','pedidos_compra',{empresa_id:nil,cliente_id:nil,creado_por:nil}],['PATCH',`pedidos_compra?id=eq.${nil}`,{estado:'enviada'}],['DELETE',`pedidos_compra?id=eq.${nil}`,null],['POST','pedidos_compra_items',{pedido_id:nil,articulo_id:nil,cantidad:1}],['PATCH',`pedidos_compra_items?id=eq.${nil}`,{cantidad:2}],['DELETE',`pedidos_compra_items?id=eq.${nil}`,null],
  ['POST','ordenes_compra',{empresa_id:nil,cliente_id:nil,proveedor_id:nil,creado_por:nil}],['PATCH',`ordenes_compra?id=eq.${nil}`,{estado:'enviada'}],['DELETE',`ordenes_compra?id=eq.${nil}`,null],['POST','ordenes_compra_items',{oc_id:nil,articulo_id:nil,cantidad:1,precio_unitario:1}],['PATCH',`ordenes_compra_items?id=eq.${nil}`,{cantidad:2}],['DELETE',`ordenes_compra_items?id=eq.${nil}`,null],
  ['POST','pedidos_deposito',{empresa_id:nil,cliente_id:nil,creado_por:nil}],['PATCH',`pedidos_deposito?id=eq.${nil}`,{estado:'enviada'}],['DELETE',`pedidos_deposito?id=eq.${nil}`,null],['POST','pedidos_deposito_items',{pedido_deposito_id:nil,articulo_id:nil,cantidad:1}],['PATCH',`pedidos_deposito_items?id=eq.${nil}`,{cantidad:2}],['DELETE',`pedidos_deposito_items?id=eq.${nil}`,null],
 ] as const
 it('denies every 4C DML operation for real authenticated browser roles',async()=>{for(const user of users)for(const [method,resource,payload] of mutations){const response=await fetch(`${url}/rest/v1/${resource}`,{method,headers:{apikey:anon!,authorization:`Bearer ${user.token}`,'content-type':'application/json',prefer:'return=minimal'},...(payload?{body:JSON.stringify(payload)}:{})});expect(response.ok,`${user.role} ${method} ${resource}`).toBe(false);expect([401,403]).toContain(response.status)}},60_000)
})
