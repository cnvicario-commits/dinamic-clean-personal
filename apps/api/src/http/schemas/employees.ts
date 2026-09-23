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
    search: z.string().trim().min(1).max(100).optional(),
    clienteId: z.string().uuid().optional(),
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
    search: { type: 'string', minLength: 1, maxLength: 100 },
    clienteId: { type: 'string', format: 'uuid' },
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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Invalid date')

export const createEmployeeBodySchema = z
  .object({
    nombreApellido: z.string().trim().min(1).max(200),
    cuil: z.string().trim().min(1).max(30),
    legajo: z.string().trim().max(100).nullable().optional().default(null),
    fechaIngreso: isoDate.nullable().optional().default(null),
    horasContrato: z.union([z.literal(4), z.literal(8)]),
    empresa: z.union([z.literal('DINAMIC'), z.literal('MORAL')]),
  })
  .strict()

export const updateEmployeeStatusBodySchema = z.object({ activo: z.boolean() }).strict()
export const employeeIdParamsSchema = z.object({ id: z.string().uuid() }).strict()
export const employeeMutationResponseSchema = employeeListItemSchema.omit({ asignaciones: true })

export type EmployeeAssignment = z.infer<typeof employeeAssignmentSchema>
export type EmployeeListItem = z.infer<typeof employeeListItemSchema>
export type EmployeesResponse = z.infer<typeof employeesResponseSchema>
export type CreateEmployeeBody = z.infer<typeof createEmployeeBodySchema>
export type UpdateEmployeeStatusBody = z.infer<typeof updateEmployeeStatusBodySchema>
export type EmployeeMutationResponse = z.infer<typeof employeeMutationResponseSchema>
