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
import {
  createAddressBodySchema,
  createClientBodySchema,
  quoteUploadBodySchema,
  statusBodySchema,
  updateAddressBodySchema,
  updateClientBodySchema,
} from './schemas/clients.js'
import { articleCreate,articleImportBody,articleUpdate,priceListBody,relationCreate,relationUpdate,supplierCreate,supplierUpdate } from './schemas/catalog.js'
import { assignments as purchaseAssignments, importBody as purchaseImportBody, purchaseOrder, purchaseRequest, transition as purchaseTransition } from './schemas/purchases.js'
import { resultsImport } from './schemas/results.js'
import { justificationDownloadSchema, justificationUploadBodySchema } from './schemas/attendance.js'
import { crmCatalogCreate, crmCatalogUpdate, crmCreateFollowUp, crmCreateOpportunity, crmCreateProspect, crmTransition, crmUpdateOpportunity, crmUpdateProspect } from './schemas/crm.js'
import {
  actionCreate,
  actionUpdate,
  auditSubmit,
  checklistActivate,
  checklistCopy,
  checklistCreate,
  checklistUpdate,
  planningBody,
  planningCancel,
  planningUpdate,
} from './schemas/audits.js'

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
const clientAddressParameters = [
  { name: 'id', in: 'path' as const, required: true, schema: { type: 'string', format: 'uuid' } },
  { name: 'addressId', in: 'path' as const, required: true, schema: { type: 'string', format: 'uuid' } },
]
const clientQuoteParameters = [
  { name: 'id', in: 'path' as const, required: true, schema: { type: 'string', format: 'uuid' } },
  { name: 'quoteId', in: 'path' as const, required: true, schema: { type: 'string', format: 'uuid' } },
]

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
    '/v1/clients': {
      get: {
        summary: 'List clients', security: bearer,
        responses: { '200': { description: 'Client list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ClientRecord' } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } },
      },
      post: {
        summary: 'Create client and optional initial address', security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateClientBody' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientRecord' } } } }, '400': { description: 'Validation' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '409': { description: 'Conflict' } },
      },
    },
    '/v1/clients/{id}': {
      get: {
        summary: 'Get client detail with addresses and quotes', security: bearer, parameters: idParameter,
        responses: { '200': { description: 'Client detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientDetail' } } } }, '400': { description: 'Invalid id' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' } },
      },
      patch: {
        summary: 'Update allowlisted client fields', security: bearer, parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateClientBody' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientRecord' } } } }, '400': { description: 'Validation' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' }, '409': { description: 'Conflict' } },
      },
    },
    '/v1/clients/{id}/addresses': {
      get: {
        summary: 'List client addresses', security: bearer, parameters: idParameter,
        responses: { '200': { description: 'Address list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ClientAddress' } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Client not found' } },
      },
      post: {
        summary: 'Create client address', security: bearer, parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateClientAddressBody' } } } },
        responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientAddress' } } } }, '400': { description: 'Validation' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Client not found' }, '409': { description: 'Conflict' } },
      },
    },
    '/v1/clients/{id}/addresses/{addressId}': {
      patch: {
        summary: 'Update allowlisted address fields', security: bearer, parameters: clientAddressParameters,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateClientAddressBody' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientAddress' } } } }, '400': { description: 'Validation' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' }, '409': { description: 'Conflict' } },
      },
    },
    '/v1/clients/{id}/addresses/{addressId}/status': {
      patch: {
        summary: 'Activate or deactivate client address', security: bearer, parameters: clientAddressParameters,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientAddressStatusBody' } } } },
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientAddress' } } } }, '400': { description: 'Validation' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Not found' } },
      },
    },
    '/v1/clients/{id}/addresses/{addressId}/principal': {
      post: {
        summary: 'Set the active address as the only principal address', security: bearer, parameters: clientAddressParameters,
        responses: { '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientAddress' } } } }, '400': { description: 'Invalid id' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Active address not found' } },
      },
    },
    '/v1/clients/{id}/quotes': {
      get: {
        summary: 'List client quote metadata', security: bearer, parameters: idParameter,
        responses: { '200': { description: 'Quote list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ClientQuote' } } } } }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Client not found' } },
      },
      post: {
        summary: 'Upload PDF quote through backend-managed private storage', security: bearer,
        parameters: [...idParameter, { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 1, maxLength: 255 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuoteUploadBody' } } } },
        responses: { '200': { description: 'Replay of the resource created by the same Idempotency-Key', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientQuote' } } } }, '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClientQuote' } } } }, '400': { description: 'Validation, missing Idempotency-Key or non-PDF' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Client not found' }, '409': { description: 'Idempotency key payload mismatch or upload still processing' }, '413': { description: 'PDF exceeds 15 MB' }, '502': { description: 'Storage or metadata persistence failure' } },
      },
    },
    '/v1/clients/{id}/quotes/{quoteId}/download': {
      get: {
        summary: 'Create a short-lived signed URL for a client quote', security: bearer, parameters: clientQuoteParameters,
        responses: { '200': { description: 'Signed download', content: { 'application/json': { schema: { $ref: '#/components/schemas/QuoteDownload' } } } }, '400': { description: 'Invalid id' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Quote not found for client' }, '502': { description: 'Storage signing failure' } },
      },
    },
    '/v1/clients/{id}/quotes/{quoteId}': {
      delete: {
        summary: 'Delete quote metadata and private object with compensation', security: bearer, parameters: clientQuoteParameters,
        responses: { '204': { description: 'Deleted' }, '400': { description: 'Invalid id' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' }, '404': { description: 'Quote not found for client' }, '502': { description: 'Storage deletion failure; metadata restore attempted' } },
      },
    },
    '/v1/purchases/catalogs':{get:{summary:'Purchase catalogs',security:bearer,responses:{'200':{description:'Catalogs'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}}}},
    '/v1/purchase-requests':{get:{summary:'List purchase requests',security:bearer,responses:{'200':{description:'List'}}},post:{summary:'Create purchase request atomically',security:bearer,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseRequestBody'}}}},responses:{'201':{description:'Created'},'400':{description:'Validation'}}}},
    '/v1/purchase-requests/{id}':{get:{summary:'Purchase request detail',security:bearer,parameters:idParameter,responses:{'200':{description:'Detail'}}},put:{summary:'Replace draft request and items atomically',security:bearer,parameters:idParameter,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseRequestBody'}}}},responses:{'200':{description:'Updated'},'409':{description:'Not editable'}}}},
    '/v1/purchase-requests/{id}/state':{patch:{summary:'Transition purchase request',security:bearer,parameters:idParameter,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseTransitionBody'}}}},responses:{'200':{description:'Transitioned'},'409':{description:'Invalid transition'}}}},
    '/v1/purchase-requests/{id}/duplicate':{post:{summary:'Duplicate purchase request atomically',security:bearer,parameters:idParameter,responses:{'201':{description:'Created'}}}},
    '/v1/purchase-request-items/{id}/discard':{patch:{summary:'Discard or restore a sent request item',security:bearer,parameters:idParameter,responses:{'200':{description:'Updated'},'409':{description:'Invalid state'}}}},
    '/v1/purchase-requests/{id}/assignments':{post:{summary:'Generate purchase orders and warehouse request atomically',security:bearer,parameters:[...idParameter,{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string'}}],requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseAssignmentsBody'}}}},responses:{'200':{description:'Generated or replayed'},'409':{description:'Conflict or over-allocation'}}}},
    '/v1/purchase-requests/import/preview':{post:{summary:'Read-only purchase import preview',security:bearer,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseImportBody'}}}},responses:{'200':{description:'Preview'}}}},
    '/v1/purchase-requests/import/apply':{post:{summary:'Apply purchase import atomically',security:bearer,parameters:[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string'}}],requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseImportBody'}}}},responses:{'200':{description:'Applied or replayed'}}}},
    '/v1/purchase-orders':{get:{summary:'List purchase orders',security:bearer,responses:{'200':{description:'List'}}},post:{summary:'Create independent purchase order atomically',security:bearer,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseOrderBody'}}}},responses:{'201':{description:'Created'}}}},
    '/v1/purchase-orders/{id}':{get:{summary:'Purchase order detail',security:bearer,parameters:idParameter,responses:{'200':{description:'Detail'}}}},
    '/v1/purchase-orders/{id}/state':{patch:{summary:'Transition purchase order',security:bearer,parameters:idParameter,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseTransitionBody'}}}},responses:{'200':{description:'Transitioned'},'409':{description:'Invalid transition'}}}},
    '/v1/purchase-orders/{id}/duplicate':{post:{summary:'Duplicate purchase order atomically',security:bearer,parameters:idParameter,responses:{'201':{description:'Created'}}}},
    '/v1/warehouse-requests':{get:{summary:'List warehouse requests',security:bearer,responses:{'200':{description:'List'}}}},
    '/v1/warehouse-requests/{id}':{get:{summary:'Warehouse request detail',security:bearer,parameters:idParameter,responses:{'200':{description:'Detail'}}}},
    '/v1/warehouse-requests/{id}/state':{patch:{summary:'Transition warehouse request',security:bearer,parameters:idParameter,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PurchaseTransitionBody'}}}},responses:{'200':{description:'Transitioned'},'409':{description:'Invalid transition'}}}},
    '/v1/warehouse-requests/{id}/duplicate':{post:{summary:'Duplicate warehouse request atomically',security:bearer,parameters:idParameter,responses:{'201':{description:'Created'}}}},
    '/v1/suppliers': { get:{summary:'List suppliers',security:bearer,responses:{'200':{description:'Supplier list'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}}},post:{summary:'Create supplier',security:bearer,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/CreateSupplierBody'}}}},responses:{'201':{description:'Created'},'400':{description:'Validation'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'},'409':{description:'Duplicate CUIT'}}}},
    '/v1/suppliers/{id}': { get:{summary:'Supplier detail',security:bearer,parameters:idParameter,responses:{'200':{description:'Supplier'},'404':{description:'Not found'}}},patch:{summary:'Update supplier',security:bearer,parameters:idParameter,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/UpdateSupplierBody'}}}},responses:{'200':{description:'Updated'},'404':{description:'Not found'}}}},
    '/v1/suppliers/{id}/status': { patch:{summary:'Set supplier status',security:bearer,parameters:idParameter,responses:{'200':{description:'Updated'}}}},
    '/v1/suppliers/{id}/articles': { get:{summary:'List supplier catalog rows',security:bearer,parameters:idParameter,responses:{'200':{description:'Supplier catalog'}}}},
    '/v1/articles': { get:{summary:'List articles',security:bearer,responses:{'200':{description:'Article list'}}},post:{summary:'Create article',security:bearer,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/CreateArticleBody'}}}},responses:{'201':{description:'Created'}}}},
    '/v1/articles/{id}': { get:{summary:'Article detail',security:bearer,parameters:idParameter,responses:{'200':{description:'Article'},'404':{description:'Not found'}}},patch:{summary:'Update article',security:bearer,parameters:idParameter,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/UpdateArticleBody'}}}},responses:{'200':{description:'Updated'}}}},
    '/v1/articles/{id}/status': { patch:{summary:'Set article status',security:bearer,parameters:idParameter,responses:{'200':{description:'Updated'}}}},
    '/v1/articles/{id}/suppliers': { get:{summary:'List article supplier relations',security:bearer,parameters:idParameter,responses:{'200':{description:'Relations'}}},post:{summary:'Create article supplier relation',security:bearer,parameters:idParameter,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/CreateSupplierArticleBody'}}}},responses:{'201':{description:'Created'}}}},
    '/v1/articles/{id}/suppliers/{relationId}': { patch:{summary:'Update article supplier relation',security:bearer,responses:{'200':{description:'Updated'}}}},
    '/v1/articles/import/preview': { post:{summary:'Preview article import without writes',security:bearer,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/ArticleImportBody'}}}},responses:{'200':{description:'Preview'}}}},
    '/v1/articles/import': { post:{summary:'Apply article import transactionally',security:bearer,parameters:[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string'}}],requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/ArticleImportBody'}}}},responses:{'200':{description:'Applied or replayed'},'409':{description:'Idempotency conflict'}}}},
    '/v1/price-lists/preview': { post:{summary:'Preview price list without writes',security:bearer,requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PriceListBody'}}}},responses:{'200':{description:'Preview'}}}},
    '/v1/price-lists/apply': { post:{summary:'Apply price list transactionally',security:bearer,parameters:[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string'}}],requestBody:{required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/PriceListBody'}}}},responses:{'200':{description:'Applied or replayed'},'409':{description:'Idempotency conflict'}}}},
    '/v1/supplier-article-pending': { get:{summary:'List unresolved supplier article rows',security:bearer,responses:{'200':{description:'Pending rows'}}}},
    '/v1/supplier-article-pending/{id}/resolve': { post:{summary:'Resolve pending row transactionally',security:bearer,parameters:idParameter,responses:{'200':{description:'Resolved'},'404':{description:'Not found'}}}},
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
    '/v1/attendance/{id}/justification': {
      post: {
        summary: 'Upload attendance justification through backend-managed private storage',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/JustificationUploadBody' } } },
        },
        responses: {
          '201': { description: 'Uploaded' },
          '400': { description: 'Validation or unsupported file type' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Attendance not found' },
          '413': { description: 'File exceeds 15 MB' },
          '502': { description: 'Storage failure' },
        },
      },
      delete: {
        summary: 'Delete attendance justification',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '204': { description: 'Deleted' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '502': { description: 'Storage deletion failure' },
        },
      },
    },
    '/v1/attendance/{id}/justification/download': {
      get: {
        summary: 'Prepare short-lived download for attendance justification',
        security: bearer,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': {
            description: 'Signed download or legacy URL',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/JustificationDownload' } } },
          },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Justification not found' },
          '502': { description: 'Storage signing failure' },
        },
      },
    },
    '/v1/hr/reports/bejerman': { get:{summary:'Bejerman report dataset',security:bearer,parameters:[{name:'from',in:'query',required:true,schema:{type:'string',format:'date'}},{name:'to',in:'query',required:true,schema:{type:'string',format:'date'}}],responses:{'200':{description:'Report dataset',content:{'application/json':{schema:{$ref:'#/components/schemas/BejermanReportData'}}}},'400':{description:'Invalid range'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}}} },
    '/v1/hr/reports/overtime': { get:{summary:'Overtime report dataset',security:bearer,parameters:[{name:'from',in:'query',required:true,schema:{type:'string',format:'date'}},{name:'to',in:'query',required:true,schema:{type:'string',format:'date'}}],responses:{'200':{description:'Report dataset',content:{'application/json':{schema:{$ref:'#/components/schemas/OvertimeReportData'}}}},'400':{description:'Invalid range'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}}} },
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
    '/v1/results': { get: { summary:'List monthly economic results', security: bearer, responses:{'200':{description:'Results'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}} } },
    '/v1/results/{id}': { get: { summary:'Get monthly result detail', security: bearer, parameters:idParameter, responses:{'200':{description:'Result detail'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'},'404':{description:'Not found'}} } },
    '/v1/results/import/preview': { post: { summary:'Preview results import', security: bearer, requestBody:{required:true,content:{'application/json':{schema:zodJsonSchema(resultsImport)}}}, responses:{'200':{description:'Preview'},'400':{description:'Validation'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'}} } },
    '/v1/results/import/apply': { post: { summary:'Apply results import', security: bearer, requestBody:{required:true,content:{'application/json':{schema:zodJsonSchema(resultsImport)}}}, responses:{'200':{description:'Applied'},'400':{description:'Validation'},'401':{description:'Unauthorized'},'403':{description:'Forbidden'},'409':{description:'Idempotency conflict'}} } },
    '/v1/crm/opportunities': { get: { summary: 'List CRM opportunities', security: bearer, responses: { '200': { description: 'Paginated opportunities' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } }, post: { summary: 'Create opportunity and initial follow-up atomically', security: bearer, parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(crmCreateOpportunity) } } }, responses: { '201': { description: 'Created or idempotent replay' }, '400': { description: 'Validation' }, '409': { description: 'Idempotency conflict' } } } },
    '/v1/crm/dashboard': { get: { summary: 'List CRM dashboard data for authenticated actor', security: bearer, responses: { '200': { description: 'Paginated opportunities, relevant follow-ups and views' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } } },
    '/v1/crm/summary': { get: { summary: 'Get CRM summary aggregates over the complete filtered universe', security: bearer, responses: { '200': { description: 'Server-side summary aggregates' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } } } },
    '/v1/crm/opportunities/{id}': { get: { summary: 'Get CRM opportunity', security: bearer, parameters: idParameter, responses: { '200': { description: 'Opportunity' }, '404': { description: 'Not found' } } }, patch: { summary: 'Update opportunity and prospect atomically with optimistic concurrency', security: bearer, parameters: idParameter, requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(crmUpdateOpportunity) } } }, responses: { '200': { description: 'Updated' }, '400': { description: 'Validation' }, '409': { description: 'Stale version' } } }, delete: { summary: 'Delete opportunity and DB-cascaded CRM history', security: bearer, parameters: idParameter, responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } } } },
    '/v1/crm/opportunities/{id}/state': { patch: { summary: 'Transition CRM opportunity state atomically with follow-up', security: bearer, parameters: idParameter, requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(crmTransition) } } }, responses: { '200': { description: 'Transitioned' }, '400': { description: 'Validation' }, '409': { description: 'Stale version' } } } },
    '/v1/crm/opportunities/{id}/follow-ups': { get: { summary: 'List opportunity follow-ups', security: bearer, parameters: idParameter, responses: { '200': { description: 'Paginated follow-ups' } } }, post: { summary: 'Create opportunity follow-up', security: bearer, parameters: idParameter, requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(crmCreateFollowUp) } } }, responses: { '200': { description: 'Created' }, '400': { description: 'Validation' }, '404': { description: 'Opportunity not found' } } } },
    '/v1/crm/opportunities/{id}/view': { put: { summary: 'Idempotently mark opportunity as viewed by caller', security: bearer, parameters: idParameter, responses: { '200': { description: 'View recorded' } } } },
    '/v1/crm/catalogs': { get: { summary: 'Get CRM form catalogs', security: bearer, responses: { '200': { description: 'Catalogs' } } } },
    '/v1/crm/prospects': { post: { summary: 'Create CRM prospect', security: bearer, requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(crmCreateProspect) } } }, responses: { '201': { description: 'Created' }, '400': { description: 'Validation' } } } },
    '/v1/crm/prospects/{id}': { patch: { summary: 'Update CRM prospect', security: bearer, parameters: idParameter, requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(crmUpdateProspect) } } }, responses: { '200': { description: 'Updated' }, '400': { description: 'Validation' }, '404': { description: 'Not found' } } } },
    '/v1/crm/{resource}': { get: { summary: 'List explicit CRM catalog resource', security: bearer, parameters: [{ name: 'resource', in: 'path', required: true, schema: { type: 'string', enum: ['tipos-cliente', 'tipos-servicio', 'referidores'] } }], responses: { '200': { description: 'Catalog items' } } }, post: { summary: 'Create explicit CRM catalog resource', security: bearer, parameters: [{ name: 'resource', in: 'path', required: true, schema: { type: 'string', enum: ['tipos-cliente', 'tipos-servicio', 'referidores'] } }], requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(crmCatalogCreate) } } }, responses: { '201': { description: 'Created' }, '400': { description: 'Validation' }, '409': { description: 'Unique conflict' } } } },
    '/v1/crm/{resource}/{id}/status': { patch: { summary: 'Set explicit CRM catalog active status', security: bearer, parameters: [{ name: 'resource', in: 'path', required: true, schema: { type: 'string', enum: ['tipos-cliente', 'tipos-servicio', 'referidores'] } }, ...idParameter], requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(crmCatalogUpdate) } } }, responses: { '200': { description: 'Updated' }, '400': { description: 'Validation' }, '404': { description: 'Not found' } } } },
    '/v1/audits/dashboard': {
      get: {
        summary: 'Server-side audit dashboard aggregates',
        security: bearer,
        parameters: [
          { name: 'desde', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': { description: 'Dashboard aggregates' },
          '400': { description: 'Invalid query' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/v1/audits/catalogs': {
      get: {
        summary: 'Audit form catalogs (clients, sites, supervisors)',
        security: bearer,
        responses: {
          '200': { description: 'Catalogs' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/v1/audits/plannings': {
      get: {
        summary: 'List audit plannings',
        security: bearer,
        responses: {
          '200': { description: 'Paginated plannings' },
          '400': { description: 'Invalid query' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
      post: {
        summary: 'Create audit planning',
        security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(planningBody) } } },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/v1/audits/plannings/{id}': {
      get: {
        summary: 'Get audit planning for edit form',
        security: bearer,
        parameters: idParameter,
        responses: {
          '200': { description: 'Planning' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
        },
      },
      patch: {
        summary: 'Update audit planning with optimistic concurrency',
        security: bearer,
        parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(planningUpdate) } } },
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '409': { description: 'Stale version or invalid state' },
        },
      },
    },
    '/v1/audits/plannings/{id}/cancel': {
      post: {
        summary: 'Cancel audit planning with optimistic concurrency',
        security: bearer,
        parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(planningCancel) } } },
        responses: {
          '200': { description: 'Cancelled' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '409': { description: 'Stale version or invalid state' },
        },
      },
    },
    '/v1/audits': {
      get: {
        summary: 'List completed audits',
        security: bearer,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'supervisorId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'desde', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': { description: 'Paginated audits with no_conformidades counts' },
          '400': { description: 'Invalid query' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
      post: {
        summary: 'Submit completed audit with responses (idempotent)',
        security: bearer,
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(auditSubmit) } } },
        responses: {
          '201': { description: 'Created or idempotent replay' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Related entity not found' },
          '409': { description: 'Idempotency or validation conflict' },
        },
      },
    },
    '/v1/audits/{id}': {
      get: {
        summary: 'Get audit detail with responses and action plans',
        security: bearer,
        parameters: idParameter,
        responses: {
          '200': { description: 'Audit detail' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/v1/audits/{id}/actions': {
      get: {
        summary: 'List action plans for one audit',
        security: bearer,
        parameters: idParameter,
        responses: {
          '200': { description: 'Actions' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Audit not found' },
        },
      },
      post: {
        summary: 'Create action plan for an audit',
        security: bearer,
        parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(actionCreate) } } },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '409': { description: 'Response belongs to another audit' },
        },
      },
    },
    '/v1/audit-actions': {
      get: {
        summary: 'Global action-plan follow-up list',
        security: bearer,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['pendiente', 'en_curso', 'resuelto'] } },
          { name: 'responsableId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'vencidos', in: 'query', schema: { type: 'boolean' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Paginated actions' },
          '400': { description: 'Invalid query' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/v1/audit-actions/{id}': {
      patch: {
        summary: 'Update action plan with optimistic concurrency',
        security: bearer,
        parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(actionUpdate) } } },
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '409': { description: 'Stale version' },
        },
      },
    },
    '/v1/audit-checklists': {
      get: {
        summary: 'List checklist templates',
        security: bearer,
        responses: {
          '200': { description: 'Templates' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
      post: {
        summary: 'Create inactive checklist template with items',
        security: bearer,
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(checklistCreate) } } },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
        },
      },
    },
    '/v1/audit-checklists/active': {
      get: {
        summary: 'Get active checklist template with ordered items',
        security: bearer,
        responses: {
          '200': { description: 'Active template' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'No active template' },
        },
      },
    },
    '/v1/audit-checklists/{id}': {
      get: {
        summary: 'Get checklist template detail with ordered items',
        security: bearer,
        parameters: idParameter,
        responses: {
          '200': { description: 'Template detail' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
        },
      },
      patch: {
        summary: 'Replace checklist items atomically (rejects historical templates)',
        security: bearer,
        parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(checklistUpdate) } } },
        responses: {
          '200': { description: 'Updated' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '409': { description: 'Stale version or historical template' },
        },
      },
    },
    '/v1/audit-checklists/{id}/copy': {
      post: {
        summary: 'Copy checklist template to a new inactive version (idempotent)',
        security: bearer,
        parameters: [
          ...idParameter,
          { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(checklistCopy) } } },
        responses: {
          '201': { description: 'Created or idempotent replay' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Source not found' },
          '409': { description: 'Idempotency conflict' },
        },
      },
    },
    '/v1/audit-checklists/{id}/activate': {
      post: {
        summary: 'Activate checklist template (single-active DB trigger)',
        security: bearer,
        parameters: idParameter,
        requestBody: { required: true, content: { 'application/json': { schema: zodJsonSchema(checklistActivate) } } },
        responses: {
          '200': { description: 'Activated' },
          '400': { description: 'Validation' },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden' },
          '404': { description: 'Not found' },
          '409': { description: 'Stale version' },
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
      CreateClientBody: zodJsonSchema(createClientBodySchema),
      UpdateClientBody: zodJsonSchema(updateClientBodySchema),
      CreateClientAddressBody: zodJsonSchema(createAddressBodySchema),
      UpdateClientAddressBody: zodJsonSchema(updateAddressBodySchema),
      ClientAddressStatusBody: zodJsonSchema(statusBodySchema),
      QuoteUploadBody: zodJsonSchema(quoteUploadBodySchema),
      CreateSupplierBody:zodJsonSchema(supplierCreate),UpdateSupplierBody:zodJsonSchema(supplierUpdate),CreateArticleBody:zodJsonSchema(articleCreate),UpdateArticleBody:zodJsonSchema(articleUpdate),CreateSupplierArticleBody:zodJsonSchema(relationCreate),UpdateSupplierArticleBody:zodJsonSchema(relationUpdate),ArticleImportBody:zodJsonSchema(articleImportBody),PriceListBody:zodJsonSchema(priceListBody),
      PurchaseRequestBody:zodJsonSchema(purchaseRequest),PurchaseOrderBody:zodJsonSchema(purchaseOrder),PurchaseAssignmentsBody:zodJsonSchema(purchaseAssignments),PurchaseImportBody:zodJsonSchema(purchaseImportBody),PurchaseTransitionBody:zodJsonSchema(purchaseTransition),
      ClientRecord: { type:'object',required:['id','nombre','cuit','persona_contacto','codigo_costos','presupuesto_4hs','presupuesto_8hs','domicilio','lleva_insumos','activo','created_at'],properties:{id:{type:'string',format:'uuid'},nombre:{type:'string'},cuit:{type:['string','null']},persona_contacto:{type:['string','null']},codigo_costos:{type:['string','null']},presupuesto_4hs:{type:'integer'},presupuesto_8hs:{type:'integer'},domicilio:{type:['string','null']},lleva_insumos:{type:['boolean','null']},activo:{type:'boolean'},created_at:{type:'string'}} },
      ClientAddress: { type:'object',required:['id','cliente_id','alias','direccion','es_principal','activo','horario_atencion','supervisor_id','created_at'],properties:{id:{type:'string',format:'uuid'},cliente_id:{type:'string',format:'uuid'},alias:{type:'string'},direccion:{type:['string','null']},es_principal:{type:'boolean'},activo:{type:'boolean'},horario_atencion:{type:['string','null']},supervisor_id:{type:['string','null'],format:'uuid'},created_at:{type:'string'}} },
      ClientQuote: { type:'object',required:['id','cliente_id','nombre_archivo','subido_por','created_at'],properties:{id:{type:'string',format:'uuid'},cliente_id:{type:'string',format:'uuid'},nombre_archivo:{type:'string'},subido_por:{type:['string','null'],format:'uuid'},subido_por_nombre:{type:['string','null']},created_at:{type:'string'}} },
      ClientDetail: { type:'object',required:['client','addresses','quotes'],properties:{client:{$ref:'#/components/schemas/ClientRecord'},addresses:{type:'array',items:{$ref:'#/components/schemas/ClientAddress'}},quotes:{type:'array',items:{$ref:'#/components/schemas/ClientQuote'}}} },
      QuoteDownload: { type:'object',required:['url','expiresIn','fileName'],properties:{url:{type:'string'},expiresIn:{type:'integer'},fileName:{type:'string'}} },
      JustificationUploadBody: zodJsonSchema(justificationUploadBodySchema),
      JustificationDownload: zodJsonSchema(justificationDownloadSchema),
      BejermanReportData: { type:'object',required:['employees','assignments','clients','attendance'],properties:{employees:{type:'array',items:{type:'object',required:['id','nombre_apellido','legajo','empresa'],properties:{id:{type:'string'},nombre_apellido:{type:'string'},legajo:{type:['string','null']},empresa:{type:['string','null']}}}},assignments:{type:'array',items:{type:'object',required:['empleado_id','cliente_id'],properties:{empleado_id:{type:'string'},cliente_id:{type:'string'}}}},clients:{type:'array',items:{type:'object',required:['id','nombre','codigo_costos'],properties:{id:{type:'string'},nombre:{type:'string'},codigo_costos:{type:['string','null']}}}},attendance:{type:'array',items:{type:'object',required:['empleado_id','fecha','codigo'],properties:{empleado_id:{type:'string'},fecha:{type:'string',format:'date'},codigo:{type:'string'}}}}}},
      OvertimeReportData: { type:'object',required:['attendance','assignments','clients'],properties:{attendance:{type:'array',items:{type:'object',required:['empleado_id','horas_extras','cliente_destino_id','cliente_horas_extra_id','nombre_apellido'],properties:{empleado_id:{type:'string'},horas_extras:{type:'number'},cliente_destino_id:{type:['string','null']},cliente_horas_extra_id:{type:['string','null']},nombre_apellido:{type:'string'}}}},assignments:{type:'array',items:{type:'object',required:['empleado_id','cliente_id'],properties:{empleado_id:{type:'string'},cliente_id:{type:'string'}}}},clients:{type:'array',items:{type:'object',required:['id','nombre'],properties:{id:{type:'string'},nombre:{type:'string'}}}}}},
      ResultsImportBody: zodJsonSchema(resultsImport),
    },
  },
} as const
