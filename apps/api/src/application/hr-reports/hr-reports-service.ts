import type { ReportDateRange } from '../../http/schemas/hr-reports.js'
export function createHrReportsService(repo:{bejerman:(from:string,to:string)=>Promise<unknown>;overtime:(from:string,to:string)=>Promise<unknown>}){return {bejerman:(range:ReportDateRange)=>repo.bejerman(range.from,range.to),overtime:(range:ReportDateRange)=>repo.overtime(range.from,range.to)}}
