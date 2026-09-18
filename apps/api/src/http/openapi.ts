import { z } from 'zod'
import {
  employeeAssignmentSchema,
  employeeListItemSchema,
  employeesResponseSchema,
  LIST_EMPLOYEES_QUERY_OPENAPI,
} from './schemas/employees.js'

/** Derive JSON Schema fragments from Zod response schemas (SoT: http/schemas/employees.ts). */
function zodJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12' }) as Record<string, unknown>
  const rest = { ...json }
  delete rest.$schema
  return rest
}

function queryParameter(
  name: keyof typeof LIST_EMPLOYEES_QUERY_OPENAPI.properties,
  required = false,
) {
  return {
    name,
    in: 'query' as const,
    required,
    schema: LIST_EMPLOYEES_QUERY_OPENAPI.properties[name],
  }
}

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Dinamic Clean API',
    version: '0.1.0',
    description: 'Enterprise backend foundation — Phase 1 vertical slice',
  },
  paths: {
    '/healthz': {
      get: {
        summary: 'Liveness',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/readyz': {
      get: {
        summary: 'Readiness (DB)',
        responses: {
          '200': { description: 'Ready' },
          '503': { description: 'Not ready' },
        },
      },
    },
    '/v1/me': {
      get: {
        summary: 'Current profile context',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Auth context DTO' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/v1/employees': {
      get: {
        summary: 'List employees (paginated, read-only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          queryParameter('page'),
          queryParameter('pageSize'),
          queryParameter('activo'),
        ],
        responses: {
          '200': {
            description: 'Employee list',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EmployeesResponse' },
              },
            },
          },
          '400': { description: 'Bad request' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      EmployeeAssignment: zodJsonSchema(employeeAssignmentSchema),
      EmployeeListItem: zodJsonSchema(employeeListItemSchema),
      EmployeesResponse: zodJsonSchema(employeesResponseSchema),
      ListEmployeesQuery: LIST_EMPLOYEES_QUERY_OPENAPI,
    },
  },
} as const
