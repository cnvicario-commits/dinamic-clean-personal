import { z } from 'zod'
import {
  employeeAssignmentSchema,
  employeeListItemSchema,
  employeeMutationResponseSchema,
  employeesResponseSchema,
  createEmployeeBodySchema,
  updateEmployeeStatusBodySchema,
  LIST_EMPLOYEES_QUERY_OPENAPI,
} from './schemas/employees.js'
import {
  assignmentListItemSchema,
  assignmentsResponseSchema,
  createAssignmentBodySchema,
  LIST_ASSIGNMENTS_QUERY_OPENAPI,
} from './schemas/assignments.js'
import { hrCatalogsResponseSchema } from './schemas/hr-catalogs.js'
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

function assignmentQueryParameter(name: keyof typeof LIST_ASSIGNMENTS_QUERY_OPENAPI.properties) {
  return { name, in: 'query' as const, required: false, schema: LIST_ASSIGNMENTS_QUERY_OPENAPI.properties[name] }
}

const idParameter = [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string', format: 'uuid' } }]

const bearer = [{ bearerAuth: [] }]

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Dinamic Clean API',
    version: '0.2.0',
    description:
      'Enterprise application backend. General IP rate limiting may return 429 on any route (except health/OpenAPI when excluded).',
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
        summary: 'List employees (paginated and filtered)',
        security: bearer,
        parameters: [
          queryParameter('page'),
          queryParameter('pageSize'),
          queryParameter('activo'),
          queryParameter('search'),
          queryParameter('clienteId'),
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
      post: {
        summary: 'Create employee', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateEmployeeBody' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeMutationResponse' } } } },
          '400': { description: 'Validation' }, '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }, '409': { description: 'Duplicate CUIL' },
        },
      },
    },
    '/v1/employees/{id}/status': {
      patch: {
        summary: 'Activate or deactivate employee', security: bearer, parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateEmployeeStatusBody' } } } },
        responses: {
          '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeMutationResponse' } } } },
          '400': { description: 'Validation' }, '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }, '404': { description: 'Not found' },
        },
      },
    },
    '/v1/assignments': {
      get: {
        summary: 'List assignments', security: bearer,
        parameters: [assignmentQueryParameter('page'), assignmentQueryParameter('pageSize'), assignmentQueryParameter('active')],
        responses: {
          '200': { description: 'Assignments', content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignmentsResponse' } } } },
          '400': { description: 'Validation' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' },
        },
      },
      post: {
        summary: 'Create assignment', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAssignmentBody' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignmentListItem' } } } },
          '400': { description: 'Validation' }, '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }, '404': { description: 'Employee or client not found' },
        },
      },
    },
    '/v1/assignments/{id}/close': {
      patch: {
        summary: 'Close an active assignment using the database current date', security: bearer, parameters: idParameter,
        responses: {
          '200': { description: 'Closed', content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignmentListItem' } } } },
          '400': { description: 'Invalid id' }, '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' }, '404': { description: 'Not found' },
          '409': { description: 'Already closed' },
        },
      },
    },
    '/v1/hr/catalogs': {
      get: {
        summary: 'Minimal employee and client catalogs for Core HR', security: bearer,
        parameters: [{ name: 'include', in: 'query', required: true, schema: { type: 'string', enum: ['employees', 'clients', 'employees,clients'] } }],
        responses: {
          '200': { description: 'Catalogs', content: { 'application/json': { schema: { $ref: '#/components/schemas/HrCatalogsResponse' } } } },
          '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' },
        },
      },
    },
    '/v1/attendance': {
      get: { summary:'List attendance', security: bearer, parameters:[{name:'page',in:'query',schema:{type:'integer',minimum:1}},{name:'pageSize',in:'query',schema:{type:'integer',minimum:1,maximum:100}},{name:'empleadoId',in:'query',schema:{type:'string',format:'uuid'}},{name:'desde',in:'query',schema:{type:'string',format:'date'}},{name:'hasta',in:'query',schema:{type:'string',format:'date'}}], responses:{'200':{description:'Attendance page'},'400':{description:'Invalid query'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}} },
      put: { summary:'Create or update attendance', security: bearer, requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['empleadoId','fecha','codigo']}}}}, responses:{'200':{description:'Attendance'},'400':{description:'Invalid body/code'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}} },
    },
    '/v1/attendance/codes': { get:{summary:'List attendance codes',security:bearer,responses:{'200':{description:'Codes'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}}} },
    '/v1/hr/reports/bejerman': { get:{summary:'Bejerman report dataset',security:bearer,parameters:[{name:'from',in:'query',required:true,schema:{type:'string',format:'date'}},{name:'to',in:'query',required:true,schema:{type:'string',format:'date'}}],responses:{'200':{description:'Report dataset'},'400':{description:'Invalid range'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}}} },
    '/v1/hr/reports/overtime': { get:{summary:'Overtime report dataset',security:bearer,parameters:[{name:'from',in:'query',required:true,schema:{type:'string',format:'date'}},{name:'to',in:'query',required:true,schema:{type:'string',format:'date'}}],responses:{'200':{description:'Report dataset'},'400':{description:'Invalid range'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}}} },
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
          '429': {
            description:
              'Rate limit exceeded (per-user sensitive budget and/or general IP limit); Retry-After may be set',
          },
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
          '429': {
            description:
              'Rate limit exceeded (per-user sensitive budget and/or general IP limit); Retry-After may be set',
          },
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
          '403': { description: 'Forbidden / MFA required' },
          '404': { description: 'Not found' },
          '429': {
            description:
              'Rate limit exceeded (per-user sensitive budget and/or general IP limit); Retry-After may be set',
          },
          '502': { description: 'Session revocation failed after password change' },
          '503': { description: 'Identity dependency unavailable' },
        },
      },
    },
    '/v1/users/{id}/disable': {
      post: {
        summary: 'Disable user (Auth ban + revoke sessions)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '204': { description: 'User disabled (idempotent if already disabled)' },
          '400': { description: 'Invalid id' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden / self-disable / MFA required' },
          '404': { description: 'Not found' },
          '409': { description: 'Last admin protected / deleted user' },
          '429': {
            description:
              'Rate limit exceeded (per-user sensitive budget and/or general IP limit); Retry-After may be set',
          },
          '502': { description: 'Identity or session revocation error' },
          '503': { description: 'Identity dependency unavailable' },
        },
      },
    },
    '/v1/users/{id}/enable': {
      post: {
        summary: 'Enable user (lift Auth ban)',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '204': { description: 'User enabled (idempotent if already active)' },
          '400': { description: 'Invalid id' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden / MFA required' },
          '404': { description: 'Not found' },
          '409': { description: 'Deleted user' },
          '429': {
            description:
              'Rate limit exceeded (per-user sensitive budget and/or general IP limit); Retry-After may be set',
          },
          '502': { description: 'Identity provider error' },
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
      CreateEmployeeBody: zodJsonSchema(createEmployeeBodySchema),
      UpdateEmployeeStatusBody: zodJsonSchema(updateEmployeeStatusBodySchema),
      EmployeeMutationResponse: zodJsonSchema(employeeMutationResponseSchema),
      AssignmentListItem: zodJsonSchema(assignmentListItemSchema),
      AssignmentsResponse: zodJsonSchema(assignmentsResponseSchema),
      ListAssignmentsQuery: LIST_ASSIGNMENTS_QUERY_OPENAPI,
      CreateAssignmentBody: zodJsonSchema(createAssignmentBodySchema),
      HrCatalogsResponse: zodJsonSchema(hrCatalogsResponseSchema),
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
