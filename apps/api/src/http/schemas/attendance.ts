import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').refine((value) => {
  const parts = value.split('-').map(Number)
  const y = parts[0]!, m = parts[1]!, d = parts[2]!
  const parsed = new Date(Date.UTC(y, m - 1, d))
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
}, 'Invalid calendar date')
export const attendanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  empleadoId: z.string().uuid().optional(),
  desde: date.optional(),
  hasta: date.optional(),
}).strict()
export const attendanceUpsertSchema = z.object({
  empleadoId: z.string().uuid(), fecha: date, codigo: z.string().min(1).max(50),
  horasExtras: z.number().finite().min(0).default(0), observaciones: z.string().max(5000).nullable().optional(),
  archivoUrl: z.string().url().nullable().optional(), clienteDestinoId: z.string().uuid().nullable().optional(),
  clienteHorasExtraId: z.string().uuid().nullable().optional(),
}).strict()
export const attendanceResponseSchema = z.object({ id:z.string(), empleadoId:z.string(), fecha:z.string(), codigo:z.string(), horasExtras:z.number(), cargadoPor:z.string().nullable(), createdAt:z.string(), observaciones:z.string().nullable(), archivoUrl:z.string().nullable(), clienteDestinoId:z.string().nullable(), clienteHorasExtraId:z.string().nullable(), empleadoNombre:z.string().nullable() })
export const attendanceListResponseSchema = z.object({ items:z.array(attendanceResponseSchema), page:z.number(), pageSize:z.number(), total:z.number() })
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>
export type AttendanceUpsert = z.infer<typeof attendanceUpsertSchema>
export const attendanceCodeSchema = z.object({ codigo:z.string(), descripcion:z.string(), codigoBejerman:z.string().nullable(), cuentaComoAusencia:z.boolean() })
