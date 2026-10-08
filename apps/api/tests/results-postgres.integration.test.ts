import { describe,expect,it,afterAll } from 'vitest'
import { createDb } from '../src/infrastructure/db/pool.js'
import { createResultsRepository } from '../src/infrastructure/db/results-repository.js'
import { loadEnv } from '../src/config/env.js'
import { randomUUID } from 'node:crypto'

const enabled=process.env.RUN_SUPABASE_INTEGRATION==='1'
const db=enabled?createDb(loadEnv()):null
const repo=db?createResultsRepository(db):null
const actor='00000000-0000-0000-0000-000000000001'
const rows=[{anio:2199,mes:12,values:{total_ventas:1234.56,resultado_periodo:-2.5},details:[{rubro:'costos',concepto:'Ajuste',monto:-2.5}]}]
const row=(anio:number,concepto:string)=>({anio,mes:12,values:{total_ventas:1234.56,resultado_periodo:-2.5},details:[{rubro:'costos',concepto,monto:-2.5}]})
describe.skipIf(!enabled)('Phase 4D PostgreSQL real integration',()=>{
 afterAll(async()=>{if(db){await db.query('delete from public.resultados_mensuales_detalle where anio between 2196 and 2199');await db.query('delete from public.resultados_mensuales where anio between 2196 and 2199');await db.query("delete from public.resultados_import_idempotency where actor_id=$1",[actor]);await db.close()}})
 it('preview is read-only and apply is atomic/idempotent',async()=>{
  const before=await db!.query('select count(*)::int as n from public.resultados_mensuales where anio=2199 and mes=12')
  const preview=await repo!.preview({rows});expect(preview.valid).toBe(1);expect(preview.newRows).toBe(1)
  const afterPreview=await db!.query('select count(*)::int as n from public.resultados_mensuales where anio=2199 and mes=12');expect(afterPreview.rows[0].n).toBe(before.rows[0].n)
  const baseKey=randomUUID();const first=await repo!.apply({rows},baseKey,actor);const replay=await repo!.apply({rows},baseKey,actor);expect(replay).toEqual(first);expect(first.createdPeriods).toEqual(['2199-12']);expect(first.updatedPeriods).toEqual([])
  const mixed=await repo!.apply({rows:[row(2199,'Ajuste'),row(2198,'Nuevo')]},randomUUID(),actor);expect(mixed.createdPeriods).toEqual(['2198-12']);expect(mixed.updatedPeriods).toEqual(['2199-12'])
  const mismatchKey=randomUUID();await repo!.apply({rows},mismatchKey,actor);await expect(repo!.apply({rows:[{...rows[0],values:{total_ventas:9}}]},mismatchKey,actor)).rejects.toMatchObject({statusCode:409})
  const detail=await repo!.detail(first.resultIds[0]);expect(detail.details).toHaveLength(1);expect(detail.resultado_periodo).toBe('-2.5')
 },30_000)
 it('rejects duplicate periods and rolls back after a detail constraint failure',async()=>{
  await expect(repo!.apply({rows:[row(2197,'A'),row(2197,'B') ]},'results-4d-duplicate-key',actor)).rejects.toMatchObject({statusCode:409})
  await repo!.apply({rows:[row(2196,'Original')]},randomUUID(),actor)
  const broken={...row(2196,'Broken'),details:[{rubro:'costos',concepto:'Dup',monto:1},{rubro:'costos',concepto:'Dup',monto:2}]}
  await expect(repo!.apply({rows:[broken]},randomUUID(),actor)).rejects.toMatchObject({statusCode:502})
  const persisted=await db!.query('select total_ventas from public.resultados_mensuales where anio=2196 and mes=12');const details=await db!.query('select concepto from public.resultados_mensuales_detalle where anio=2196 and mes=12');expect(persisted.rows[0].total_ventas).toBe('1234.56');expect(details.rows.map(r=>r.concepto)).toEqual(['Original'])
 },30_000)
 it('protects concurrent imports with same and different idempotency keys',async()=>{
  const sameKey=randomUUID();const same=await Promise.all([repo!.apply({rows:[row(2197,'Same')]},sameKey,actor),repo!.apply({rows:[row(2197,'Same')]},sameKey,actor)]);expect(same[0]).toEqual(same[1]);
  const different=await Promise.all([repo!.apply({rows:[row(2197,'Left')]},randomUUID(),actor),repo!.apply({rows:[row(2197,'Right')]},randomUUID(),actor)]);expect(different).toHaveLength(2);const persisted=await db!.query('select count(*)::int as n from public.resultados_mensuales where anio=2197 and mes=12');const details=await db!.query('select concepto from public.resultados_mensuales_detalle where anio=2197 and mes=12');expect(persisted.rows[0].n).toBe(1);expect(details.rows).toHaveLength(1);expect(['Left','Right']).toContain(details.rows[0].concepto)
 },30_000)
})
