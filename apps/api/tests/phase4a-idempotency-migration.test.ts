import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'

const sql=readFileSync(new URL('../../../supabase/migrations/forward/20260928130000_phase4a_quote_upload_idempotency.sql',import.meta.url),'utf8')
describe('Phase 4A quote idempotency migration',()=>{
  it('persists the key at actor and client scope with a payload hash',()=>{expect(sql).toContain('PRIMARY KEY (cliente_id, actor_id, idempotency_key)');expect(sql).toContain('payload_hash');expect(sql).toContain("status IN ('PROCESSING', 'COMPLETED', 'FAILED')")})
  it('keeps browser access closed and grants only the backend role',()=>{expect(sql).toContain('REVOKE ALL ON TABLE public.cliente_presupuesto_upload_idempotency FROM anon, authenticated');expect(sql).toContain('GRANT SELECT, INSERT, UPDATE ON TABLE public.cliente_presupuesto_upload_idempotency TO dinamic_api');expect(sql).toContain('ENABLE ROW LEVEL SECURITY')})
})
