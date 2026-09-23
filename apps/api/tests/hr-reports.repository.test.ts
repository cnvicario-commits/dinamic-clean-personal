import { describe, expect, it, vi } from 'vitest'
import { createHrReportsRepository } from '../src/infrastructure/db/hr-reports-repository.js'
describe('hr reports repository',()=>{
  it('uses parameterized inclusive date ranges and active assignments for Bejerman',async()=>{
    const query=vi.fn().mockResolvedValue({rows:[]});const repo=createHrReportsRepository({query} as never)
    await expect(repo.bejerman('2026-09-01','2026-09-30')).resolves.toEqual({employees:[],assignments:[],clients:[],attendance:[]})
    const calls=query.mock.calls;expect(calls).toHaveLength(4);expect(calls.some(([sql,_params])=>String(sql).includes('fecha_hasta is null'))).toBe(true);expect(calls.some(([sql,params])=>String(sql).includes('fecha >= $1')&&params[0]==='2026-09-01'&&params[1]==='2026-09-30')).toBe(true)
  })
  it('filters overtime and joins employee name',async()=>{
    const query=vi.fn().mockResolvedValue({rows:[]});const repo=createHrReportsRepository({query} as never);await repo.overtime('2026-09-01','2026-09-30');const sql=String(query.mock.calls[0][0]);expect(sql).toContain('horas_extras > 0');expect(sql).toContain('join public.empleados');expect(query.mock.calls[0][1]).toEqual(['2026-09-01','2026-09-30'])
  })
})
