import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'

const sql=readFileSync(new URL('../../../supabase/migrations/forward/20260928120000_phase4a_clients.sql',import.meta.url),'utf8')
describe('Phase 4A browser bypass closure migration',()=>{
  it('revokes browser DML for all three tables',()=>{expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.clientes, public\.cliente_domicilios, public\.cliente_presupuestos FROM anon, authenticated/i)})
  it('drops every known browser write policy for clients, addresses, quotes and storage',()=>{for(const policy of ['admin_crea_clientes','admin_edita_clientes','admin_borra_clientes','cliente_domicilios_authenticated_all','cliente_presupuestos_authenticated_all','presupuestos_clientes_storage_authenticated_all'])expect(sql).toContain(`DROP POLICY IF EXISTS ${policy}`)})
  it('removes renamed browser policies scoped to the private quote bucket',()=>{expect(sql).toContain("roles && ARRAY['public'::name, 'anon'::name, 'authenticated'::name]");expect(sql).toContain("LIKE '%presupuestos-clientes%'");expect(sql).toContain("DROP POLICY %I ON storage.objects")})
})
