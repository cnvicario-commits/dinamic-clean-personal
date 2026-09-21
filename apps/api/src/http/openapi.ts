import { z } from 'zod'
import {
  employeeAssignmentSchema,
  employeeListItemSchema,
  employeesResponseSchema,
  LIST_EMPLOYEES_QUERY_OPENAPI,
} from './schemas/employees.js'
import {
  adminUserResponseSchema,
  changeUserRoleBodySchema,
  createUserBodySchema,
  meResponseSchema,
  profileResponseSchema,
  setUserPasswordBodySchema,
  updateOwnProfileBodySchema,
  usersListResponseSchema,
} from './schemas/users.js'

/** Derive JSON Schema fragments from Zod response schemas. */
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

const bearer = [{ bearerAuth: [] }]

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Dinamic Clean API',
    version: '0.2.0',
    description: 'Enterprise backend — Phase 2B users/profiles',
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
        security: bearer,
        responses: {
          '200': {
            description: 'Auth context DTO',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MeResponse' } },
            },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
      patch: {
        summary: 'Update own profile (SELF_EDITABLE fields only)',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateOwnProfileBody' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated profile',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProfileResponse' } },
            },
          },
          '400': { description: 'Validation / privileged field rejected' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/v1/employees': {
      get: {
        summary: 'List employees (paginated, read-only)',
        security: bearer,
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
    '/v1/users': {
      get: {
        summary: 'List profiles (admin)',
        security: bearer,
        responses: {
          '200': {
            description: 'Users list',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/UsersListResponse' } },
            },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '503': { description: 'Identity dependency unavailable' },
        },
      },
      post: {
        summary: 'Create Auth user + profile (admin)',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateUserBody' } },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminUserResponse' } },
            },
          },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '409': { description: 'Conflict (duplicate email)' },
          '503': { description: 'Identity dependency unavailable' },
        },
      },
    },
    '/v1/users/{id}': {
      get: {
        summary: 'Get profile by id (admin)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Profile',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AdminUserResponse' } },
            },
          },
          '400': { description: 'Invalid id' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/v1/users/{id}/role': {
      patch: {
        summary: 'Change user role (dedicated; admin)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ChangeUserRoleBody' } },
          },
        },
        responses: {
          '200': {
            description: 'Updated role',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProfileResponse' } },
            },
          },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/v1/users/{id}/password': {
      post: {
        summary: 'Set user password (admin)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SetUserPasswordBody' } },
          },
        },
        responses: {
          '204': { description: 'Password updated' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '503': { description: 'Identity dependency unavailable' },
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
      MeResponse: zodJsonSchema(meResponseSchema),
      ProfileResponse: zodJsonSchema(profileResponseSchema),
      AdminUserResponse: zodJsonSchema(adminUserResponseSchema),
      UsersListResponse: zodJsonSchema(usersListResponseSchema),
      UpdateOwnProfileBody: zodJsonSchema(updateOwnProfileBodySchema),
      CreateUserBody: zodJsonSchema(createUserBodySchema),
      ChangeUserRoleBody: zodJsonSchema(changeUserRoleBodySchema),
      SetUserPasswordBody: zodJsonSchema(setUserPasswordBodySchema),
    },
  },
} as const
