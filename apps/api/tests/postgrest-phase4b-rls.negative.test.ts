import { describe,expect,it } from 'vitest'
import { signAccessToken } from './helpers.js'
const ready=Boolean(process.env.RUN_SUPABASE_INTEGRATION==='1'&&process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY&&process.env.SUPABASE_JWT_SECRET)
const nil='00000000-0000-0000-0000-000000000000'
describe.skipIf(!ready)('Phase 4B direct browser bypass negative',()=>{
 const actors=[['admin','4b9aaf89-e8b7-444b-9866-3afae13b4315'],['compras','d2922e19-bfbc-4a15-9a51-af40336ce9da'],['gerente','77777777-7777-4777-8777-777777777777']] as const
 const mutations=[
  ['POST','proveedores',{razon_social:'DENY',cuit:`deny-${crypto.randomUUID()}`}],['PATCH',`proveedores?id=eq.${nil}`,{razon_social:'DENY'}],['DELETE',`proveedores?id=eq.${nil}`,null],
  ['POST','articulos',{nombre:'DENY'}],['PATCH',`articulos?id=eq.${nil}`,{nombre:'DENY'}],['DELETE',`articulos?id=eq.${nil}`,null],
  ['POST','articulos_proveedor',{articulo_id:nil,proveedor_id:nil,precio:1}],['PATCH',`articulos_proveedor?id=eq.${nil}`,{precio:2}],['DELETE',`articulos_proveedor?id=eq.${nil}`,null],
  ['POST','articulos_proveedor_pendientes',{proveedor_id:nil,precio:1}],['PATCH',`articulos_proveedor_pendientes?id=eq.${nil}`,{resuelto:true}],['DELETE',`articulos_proveedor_pendientes?id=eq.${nil}`,null],
 ] as const
 it('denies the complete mutation matrix for admin, gerente and compras JWTs',async()=>{for(const [role,sub] of actors){const token=await signAccessToken({sub,secret:process.env.SUPABASE_JWT_SECRET!,issuer:`${process.env.SUPABASE_URL}/auth/v1`});for(const [method,resource,body] of mutations){const response=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${resource}`,{method,headers:{apikey:process.env.SUPABASE_ANON_KEY!,authorization:`Bearer ${token}`,'content-type':'application/json',prefer:'return=minimal'},...(body?{body:JSON.stringify(body)}:{})});expect(response.ok,`${role} ${method} ${resource}`).toBe(false);expect([401,403]).toContain(response.status)}}})
 it('anon mutation is denied',async()=>{const response=await fetch(`${process.env.SUPABASE_URL}/rest/v1/proveedores`,{method:'POST',headers:{apikey:process.env.SUPABASE_ANON_KEY!,'content-type':'application/json'},body:JSON.stringify({razon_social:'DENY',cuit:`deny-${crypto.randomUUID()}`})});expect(response.ok).toBe(false);expect([401,403]).toContain(response.status)})
})
