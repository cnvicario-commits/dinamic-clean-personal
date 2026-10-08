import { z } from 'zod'

const id = z.string().uuid()

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    value => {
      const year = Number(value.slice(0, 4))
      const month = Number(value.slice(5, 7))
      const day = Number(value.slice(8, 10))
      const parsed = new Date(Date.UTC(year, month - 1, day))
      return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      )
    },
    { message: 'Invalid calendar date' },
  )

const nullableText = z.string().trim().max(4000).nullable().optional().default(null)

const queryBoolean = z.union([
  z.literal(true),
  z.literal(false),
  z.literal('true').transform(() => true as const),
  z.literal('false').transform(() => false as const),
])

export const auditState = z.enum(['planificada', 'realizada', 'vencida', 'cancelada'])
export const actionState = z.enum(['pendiente', 'en_curso', 'resuelto'])
export const answerResult = z.enum(['conforme', 'no_conforme', 'no_aplica'])

/** Planning list query (fecha_propuesta range). Only params with real repository effect. */
export const auditListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    estado: auditState.optional(),
    supervisorId: id.optional(),
    desde: date.optional(),
    hasta: date.optional(),
  })
  .strict()

/** Completed audits list (fecha_realizada range). */
export const auditPageQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    supervisorId: id.optional(),
    desde: date.optional(),
    hasta: date.optional(),
    q: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

/** Global action follow-up list. */
export const actionListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    estado: actionState.optional(),
    responsableId: id.optional(),
    vencidos: queryBoolean.optional(),
    q: z.string().trim().min(1).max(200).optional(),
  })
  .strict()

/** Dashboard aggregates — optional audit-date window only. */
export const dashboardQuery = z
  .object({
    desde: date.optional(),
    hasta: date.optional(),
  })
  .strict()

const planningFields = {
  aliasId: id,
  fechaPropuesta: date,
  horarioDesde: z.string().regex(/^\d{2}:\d{2}/).nullable().optional().default(null),
  horarioHasta: z.string().regex(/^\d{2}:\d{2}/).nullable().optional().default(null),
  supervisorId: id,
  observaciones: nullableText,
}

const validatePlanningHours = (
  v: { horarioDesde: string | null; horarioHasta: string | null },
  c: z.RefinementCtx,
) => {
  if (v.horarioDesde && v.horarioHasta && v.horarioHasta <= v.horarioDesde) {
    c.addIssue({ code: 'custom', message: 'End time must be after start time' })
  }
}

export const planningBody = z.object(planningFields).strict().superRefine(validatePlanningHours)

export const planningUpdate = z
  .object({ ...planningFields, updatedAt: z.string().datetime() })
  .strict()
  .superRefine(validatePlanningHours)

export const planningCancel = z.object({ updatedAt: z.string().datetime() }).strict()

export const auditAnswer = z
  .object({
    itemId: id,
    resultado: answerResult,
    observaciones: nullableText,
  })
  .strict()
  .superRefine((v, c) => {
    if (v.resultado === 'no_conforme' && !v.observaciones?.trim()) {
      c.addIssue({ code: 'custom', message: 'Observation is required for no_conforme' })
    }
  })

export const auditSubmit = z
  .object({
    planificacionId: id.nullable().optional().default(null),
    aliasId: id,
    plantillaId: id,
    fechaRealizada: date,
    supervisorId: id,
    evaluacionGeneral: nullableText,
    proximaSupervisionFecha: date.nullable().optional().default(null),
    quejasComentariosCliente: nullableText,
    otros: nullableText,
    respuestas: z.array(auditAnswer).min(1),
  })
  .strict()

export const checklistItem = z
  .object({
    id: id.optional(),
    orden: z.number().int().min(1),
    texto: z.string().trim().min(1).max(4000),
  })
  .strict()

const rejectDuplicateOrder = (items: Array<{ orden: number }>, c: z.RefinementCtx) => {
  if (new Set(items.map(item => item.orden)).size !== items.length) {
    c.addIssue({ code: 'custom', message: 'Checklist item order must be unique' })
  }
}

export const checklistCreate = z
  .object({
    codigoFormulario: z.string().trim().min(1).max(200),
    version: z.string().trim().min(1).max(200),
    vigenciaDesde: date,
    items: z.array(checklistItem).min(1),
  })
  .strict()
  .superRefine((v, c) => rejectDuplicateOrder(v.items, c))

export const checklistUpdate = z
  .object({
    updatedAt: z.string().datetime(),
    items: z.array(checklistItem).min(1),
  })
  .strict()
  .superRefine((v, c) => rejectDuplicateOrder(v.items, c))

export const checklistActivate = z.object({ updatedAt: z.string().datetime() }).strict()

export const checklistCopy = z
  .object({
    version: z.string().trim().min(1).max(200),
    vigenciaDesde: date,
  })
  .strict()

export const actionCreate = z
  .object({
    respuestaId: id.nullable().optional().default(null),
    descripcion: z.string().trim().min(1).max(4000),
    responsableId: id.nullable().optional().default(null),
    fechaLimite: date.nullable().optional().default(null),
  })
  .strict()

export const actionUpdate = z
  .object({
    updatedAt: z.string().datetime(),
    estado: actionState,
    responsableId: id.nullable().optional(),
    fechaLimite: date.nullable().optional(),
    descripcion: z.string().trim().min(1).max(4000).optional(),
  })
  .strict()

export type AuditListQuery = z.infer<typeof auditListQuery>
export type AuditPageQuery = z.infer<typeof auditPageQuery>
export type ActionListQuery = z.infer<typeof actionListQuery>
export type DashboardQuery = z.infer<typeof dashboardQuery>
export type PlanningBody = z.infer<typeof planningBody>
export type PlanningUpdate = z.infer<typeof planningUpdate>
export type AuditSubmit = z.infer<typeof auditSubmit>
export type ChecklistCreate = z.infer<typeof checklistCreate>
export type ChecklistUpdate = z.infer<typeof checklistUpdate>
export type ChecklistCopy = z.infer<typeof checklistCopy>
export type ActionCreate = z.infer<typeof actionCreate>
export type ActionUpdate = z.infer<typeof actionUpdate>
