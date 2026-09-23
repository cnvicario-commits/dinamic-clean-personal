import { z } from 'zod'
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Invalid date').refine(v=>{const [y,m,d]=v.split('-').map(Number);const x=new Date(Date.UTC(y!,m!-1,d!));return x.getUTCFullYear()===y&&x.getUTCMonth()===m!-1&&x.getUTCDate()===d},'Invalid calendar date')
export const reportDateRangeQuerySchema=z.object({from:date,to:date}).strict().refine(v=>v.from<=v.to,{message:'from must be before or equal to to',path:['from']})
export type ReportDateRange=z.infer<typeof reportDateRangeQuerySchema>
