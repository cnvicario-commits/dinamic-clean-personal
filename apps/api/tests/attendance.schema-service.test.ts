import { describe, expect, it, vi } from 'vitest'
import { attendanceQuerySchema, attendanceUpsertSchema } from '../src/http/schemas/attendance.js'
import { createAttendanceService } from '../src/application/attendance/attendance-service.js'

const valid = { empleadoId:'11111111-1111-4111-8111-111111111111', fecha:'2026-02-28', codigo:'P' }
describe('attendance schemas',()=>{
  it('accepts valid query/body and rejects invalid calendar dates and unknown fields',()=>{
    expect(attendanceQuerySchema.safeParse({page:1,pageSize:25,desde:'2026-02-28'}).success).toBe(true)
    expect(attendanceQuerySchema.safeParse({page:0}).success).toBe(false)
    expect(attendanceQuerySchema.safeParse({pageSize:101}).success).toBe(false)
    expect(attendanceQuerySchema.safeParse({empleadoId:'bad'}).success).toBe(false)
    expect(attendanceQuerySchema.safeParse({desde:'2026-02-31'}).success).toBe(false)
    expect(attendanceQuerySchema.safeParse({unknown:true}).success).toBe(false)
    expect(attendanceUpsertSchema.safeParse(valid).success).toBe(true)
    expect(attendanceUpsertSchema.safeParse({...valid,horasExtras:-1}).success).toBe(false)
    expect(attendanceUpsertSchema.safeParse({...valid,fecha:'2026-13-01'}).success).toBe(false)
    expect(attendanceUpsertSchema.safeParse({...valid,archivoUrl:'bad'}).success).toBe(false)
    expect(attendanceUpsertSchema.safeParse({...valid,unknown:true}).success).toBe(false)
  })
})
describe('attendance service',()=>{
  it('delegates valid code with actor and rejects unknown code before upsert',async()=>{
    const repo={list:vi.fn(),listCodes:vi.fn().mockResolvedValue([{codigo:'P'}]),upsert:vi.fn().mockResolvedValue({id:'x'})}
    const service=createAttendanceService(repo)
    await service.upsert(valid,'actor'); expect(repo.upsert).toHaveBeenCalledWith(valid,'actor')
    repo.listCodes.mockResolvedValueOnce([]); await expect(service.upsert(valid,'actor')).rejects.toMatchObject({status:400}); expect(repo.upsert).toHaveBeenCalledTimes(1)
  })
})
