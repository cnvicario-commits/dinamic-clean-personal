import { describe,expect,it } from 'vitest'
import { readFileSync } from 'node:fs'
const sql=readFileSync(new URL('../../../supabase/migrations/forward/20260929110000_phase4c_purchases_api.sql',import.meta.url),'utf8')
describe('Phase 4C migration security',()=>{
 it('removes browser DML and grants the runtime role without admin privileges',()=>{for(const table of ['pedidos_compra','pedidos_compra_items','ordenes_compra','ordenes_compra_items','pedidos_deposito','pedidos_deposito_items'])expect(sql).toContain(`'${table}'`);expect(sql).toContain('revoke all privileges on table');expect(sql).toContain('to dinamic_api');expect(sql).not.toMatch(/grant\s+all/i);expect(sql).not.toMatch(/bypassrls/i)})
 it('defines persistent idempotency and allocation indexes',()=>{expect(sql).toContain('purchase_operation_idempotency');expect(sql).toContain('purchase_request_import');expect(sql).toContain('purchase_order_generate');expect(sql).toContain('ordenes_compra_items_pedido_compra_item_idx');expect(sql).toContain('pedidos_deposito_items_pedido_compra_item_idx')})
})
