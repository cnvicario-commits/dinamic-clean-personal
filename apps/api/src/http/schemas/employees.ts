import { z } from 'zod'

/** Query: only true/false or "true"/"false" (Fastify querystrings are strings). */
const queryBoolean = z.union([
  z.literal(true),
  z.literal(false),
  z.literal('true').transform(() => true as const),
  z.literal('false').transform(() => false as const),
])

/**
 * Runtime source of truth for GET /v1/employees query.
 * Unknown keys → 400 (strict). Invalid page/pageSize/activo → 400.
 */
export const listEmployeesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    activo: queryBoolean.optional(),
  })
  .strict()

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>

/**
 * OpenAPI description kept in the same module as the Zod schema (SoT).
 * Query boolean uses string/boolean literals with transforms that are not JSON-Schema-representable,
 * so this map mirrors the Zod constraints for docs/codegen.
 */
export const LIST_EMPLOYEES_QUERY_OPENAPI = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
    activo: {
      oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }],
    },
  },
} as const

export const employeeAssignmentSchema = z.object({
  fecha_desde: z.string(),
  fecha_hasta: z.string().nullable(),
  clientes: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
    })
    .nullable(),
})

export const employeeListItemSchema = z.object({
  id: z.string().uuid(),
  nombre_apellido: z.string(),
  cuil: z.string(),
  fecha_ingreso: z.string().nullable(),
  horas_contrato: z.number(),
  activo: z.boolean(),
  asignaciones: z.array(employeeAssignmentSchema),
})

export const employeesResponseSchema = z.object({
  items: z.array(employeeListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
})

export type EmployeeAssignment = z.infer<typeof employeeAssignmentSchema>
export type EmployeeListItem = z.infer<typeof employeeListItemSchema>
export type EmployeesResponse = z.infer<typeof employeesResponseSchema>
