import { badRequest } from '../../http/errors/app-error.js'
import type { AttendanceQuery, AttendanceUpsert } from '../../http/schemas/attendance.js'
export function createAttendanceService(repo: { list:(q:AttendanceQuery)=>Promise<unknown>; upsert:(v:AttendanceUpsert,userId:string)=>Promise<unknown>; listCodes:()=>Promise<unknown> }) {
  return {
    list: (q:AttendanceQuery) => repo.list(q),
    codes: () => repo.listCodes(),
    async upsert(v:AttendanceUpsert,userId:string){
      const codes = await repo.listCodes() as Array<{codigo:string}>
      if (!codes.some((c)=>c.codigo===v.codigo)) throw badRequest('Unknown attendance code', { codigo: v.codigo })
      return repo.upsert(v,userId)
    },
  }
}
