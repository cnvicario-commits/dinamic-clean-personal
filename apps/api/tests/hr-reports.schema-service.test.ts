import { describe, expect, it, vi } from 'vitest'
import { reportDateRangeQuerySchema } from '../src/http/schemas/hr-reports.js'
import { createHrReportsService } from '../src/application/hr-reports/hr-reports-service.js'
describe('hr reports range schema',()=>{
  it('accepts valid and same-day ranges, rejects calendar/order/unknown errors',()=>{
    expect(reportDateRangeQuerySchema.safeParse({from:'2026-09-01',to:'2026-09-30'}).success).toBe(true)
    expect(reportDateRangeQuerySchema.safeParse({from:'2026-09-01',to:'2026-09-01'}).success).toBe(true)
    for(const x of [{from:'2026-02-31',to:'2026-03-01'},{from:'2026-13-01',to:'2026-09-01'},{from:'2026-09-02',to:'2026-09-01'},{from:'bad',to:'2026-09-01'},{from:'2026-09-01',to:'2026-09-02',x:1}])expect(reportDateRangeQuerySchema.safeParse(x).success).toBe(false)
  })
})
describe('hr reports service',()=>{
  it('delegates each dataset with the validated range',async()=>{
    const repo={bejerman:vi.fn().mockResolvedValue({b:1}),overtime:vi.fn().mockResolvedValue({o:1})};const service=createHrReportsService(repo);const range={from:'2026-09-01',to:'2026-09-30'}
    await expect(service.bejerman(range)).resolves.toEqual({b:1});await expect(service.overtime(range)).resolves.toEqual({o:1});expect(repo.bejerman).toHaveBeenCalledWith(range.from,range.to);expect(repo.overtime).toHaveBeenCalledWith(range.from,range.to)
  })
})
