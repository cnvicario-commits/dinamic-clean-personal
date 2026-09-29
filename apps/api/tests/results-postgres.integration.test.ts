import { describe,expect,it,afterAll } from 'vitest'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createResultsRepository } from '../src/infrastructure/db/results-repository.js'
import { loadEnv } from '../src/config/env.js'

const enabled=process.env.RUN_SUPABASE_INTEGRATION==='1'
const db=enabled?createDb(loadEnv()):null
const repo=db?createResultsRepository(db):null
const actor='00000000-0000-0000-0000-000000000001'
const rows=[{anio:2199,mes:12,values:{total_ventas:1234.56,resultado_periodo:-2.5},details:[{rubro:'costos',concepto:'Ajuste',monto:-2.5}]}]
describe.skipIf(!enabled)('Phase 4D PostgreSQL real integration',()=>{
 afterAll(async()=>{if(db){await db.query('delete from public.resultados_mensuales_detalle where anio=2199 and mes=12');await db.query('delete from public.resultados_mensuales where anio=2199 and mes=12');await db.close()}})
 it('preview is read-only and apply is atomic/idempotent',async()=>{
  const before=await db!.query('select count(*)::int as n from public.resultados_mensuales where anio=2199 and mes=12')
  const preview=await repo!.preview({rows});expect(preview.valid).toBe(1)
  const afterPreview=await db!.query('select count(*)::int as n from public.resultados_mensuales where anio=2199 and mes=12');expect(afterPreview.rows[0].n).toBe(before.rows[0].n)
  const first=await repo!.apply({rows},'results-4d-integration-key',actor);const replay=await repo!.apply({rows},'results-4d-integration-key',actor);expect(replay).toEqual(first)
  await expect(repo!.apply({rows:[{...rows[0],values:{total_ventas:9}}]},'results-4d-integration-key',actor)).rejects.toMatchObject({statusCode:409})
  const detail=await repo!.detail(first.resultIds[0]);expect(detail.details).toHaveLength(1);expect(detail.resultado_periodo).toBe('-2.5')
 },30_000)
})
