import { z } from 'zod'

const queryBoolean = z.union([
  z.literal(true), z.literal(false),
  z.literal('true').transform(() => true as const),
  z.literal('false').transform(() => false as const),
])
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Invalid date')

export const listAssignmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  active: queryBoolean.optional(),
}).strict()
export const createAssignmentBodySchema = z.object({
  empleadoId: z.string().uuid(), clienteId: z.string().uuid(), fechaDesde: isoDate,
}).strict()
export const assignmentIdParamsSchema = z.object({ id: z.string().uuid() }).strict()
export const assignmentListItemSchema = z.object({
  id: z.string().uuid(), empleado_id: z.string().uuid(), empleado_nombre: z.string(),
  cliente_id: z.string().uuid(), cliente_nombre: z.string(), fecha_desde: z.string(),
  fecha_hasta: z.string().nullable(),
})
export const assignmentsResponseSchema = z.object({
  items: z.array(assignmentListItemSchema), page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100), total: z.number().int().min(0),
})
export const LIST_ASSIGNMENTS_QUERY_OPENAPI = {
  type: 'object', additionalProperties: false,
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    active: { oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }] },
  },
} as const
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>
export type CreateAssignmentBody = z.infer<typeof createAssignmentBodySchema>
export type AssignmentListItem = z.infer<typeof assignmentListItemSchema>
export type AssignmentsResponse = z.infer<typeof assignmentsResponseSchema>
