import { z } from 'zod'
import { RESULTS_IMPORT_MAX_ROWS } from '../../domain/import-limits.js'

const amount = z.number().finite().nullable()
export const resultRow = z.object({
  anio: z.number().int().min(1900).max(2200), mes: z.number().int().min(1).max(12),
  values: z.record(z.string(), amount),
  details: z.array(z.object({ rubro: z.string().trim().min(1).max(120), concepto: z.string().trim().min(1).max(200), monto: z.number().finite() })).max(5000),
}).strict()
export const resultsImport = z.object({ rows: z.array(resultRow).min(1).max(RESULTS_IMPORT_MAX_ROWS) }).strict()
export const resultsQuery = z.object({ anio: z.coerce.number().int().optional(), mes: z.coerce.number().int().min(1).max(12).optional() }).strict()
export type ResultsImport = z.infer<typeof resultsImport>
