import { z } from "zod";

export const crmId = z.string().uuid();
export const crmState = z.enum(["en_seguimiento", "aceptado", "rechazado", "en_espera"]);
const text = z.string().trim().max(2000).nullable().optional().default(null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const queryBoolean = z.union([
  z.literal("true").transform(() => true),
  z.literal("false").transform(() => false),
]);

export const crmListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    estado: crmState.optional(),
    responsableId: crmId.optional(),
    prospectoId: crmId.optional(),
    tipoClienteId: crmId.optional(),
    tipoServicioId: crmId.optional(),
    desde: date.optional(),
    hasta: date.optional(),
    search: z.string().trim().min(1).max(100).optional(),
    proximaFecha: queryBoolean.optional(),
    facturacion: queryBoolean.optional(),
    order: z.enum(["created", "ingreso", "agenda", "facturacion"]).default("created"),
  })
  .strict();
export const crmCreateProspect = z
  .object({
    nombre: z.string().trim().min(1).max(300),
    tipoClienteId: crmId.nullable().optional().default(null),
    contactoNombre: text,
    telefono: text,
    email: text,
    referidoPorId: crmId.nullable().optional().default(null),
    notas: text,
  })
  .strict();
export const crmUpdateProspect = crmCreateProspect
  .partial()
  .strict()
  .refine((x) => Object.keys(x).length > 0);
export const crmCreateOpportunity = z
  .object({
    prospectoId: crmId,
    numeroReferencia: text,
    fechaIngreso: date.optional(),
    tipoServicioId: crmId.nullable().optional().default(null),
    cantidadPersonal: z.number().finite().nullable().optional().default(null),
    montoEstimado: z.number().finite().nullable().optional().default(null),
    fechaEnvio: date.nullable().optional().default(null),
    comisionMonto: z.number().finite().nullable().optional().default(null),
    comentarios: text,
    responsableId: crmId,
    seguimientoInicial: z.boolean().optional().default(true),
  })
  .strict();
export const crmUpdateOpportunity = z
  .object({
    numeroReferencia: text,
    tipoServicioId: crmId.nullable().optional(),
    cantidadPersonal: z.number().finite().nullable().optional(),
    montoEstimado: z.number().finite().nullable().optional(),
    fechaEnvio: date.nullable().optional(),
    fechaFacturacion: date.nullable().optional(),
    comisionMonto: z.number().finite().nullable().optional(),
    comisionLiquidada: z.boolean().optional(),
    comentarios: text,
    prospecto: crmUpdateProspect.optional(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .refine((x) => Object.keys(x).some((k) => k !== "updatedAt"));
export const crmTransition = z
  .object({ estado: crmState, updatedAt: z.string().datetime() })
  .strict();
export const crmCreateFollowUp = z
  .object({
    fechaContacto: date.optional(),
    tipoContacto: text,
    nota: z.string().trim().min(1).max(4000),
    proximaFechaSeguimiento: date.nullable().optional().default(null),
  })
  .strict();
export const crmCatalogCreate = z.object({ nombre: z.string().trim().min(1).max(300) }).strict();
export const crmCatalogUpdate = z.object({ activo: z.boolean() }).strict();
export const crmLeadState = z.enum(["por_contactar", "en_conversacion", "convertido", "sin_interes"]);
export const crmLeadMutableState = z.enum(["por_contactar", "en_conversacion", "sin_interes"]);
const optionalText = z.string().trim().max(2000).nullable().optional();
export const crmLeadListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    estado: crmLeadState.optional(),
    responsableId: crmId.optional(),
    search: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
export const crmCreateLead = z
  .object({
    prospectoId: crmId,
    responsableId: crmId,
    proximaFechaContacto: date.nullable().optional().default(null),
    notas: text,
  })
  .strict();
export const crmUpdateLead = z
  .object({
    proximaFechaContacto: date.nullable().optional(),
    notas: optionalText,
    prospecto: crmUpdateProspect.optional(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .refine((x) => Object.keys(x).some((k) => k !== "updatedAt"));
export const crmLeadTransition = z.object({ estado: crmLeadMutableState }).strict();
export const crmCreateLeadFollowUp = z
  .object({
    fechaContacto: date.optional(),
    tipoContacto: text,
    nota: z.string().trim().min(1).max(4000),
    proximaFechaContacto: date.nullable().optional().default(null),
  })
  .strict();
export const crmConvertLead = z
  .object({
    numeroReferencia: text,
    fechaIngreso: date.optional(),
    tipoServicioId: crmId.nullable().optional().default(null),
    cantidadPersonal: z.number().finite().nullable().optional().default(null),
    montoEstimado: z.number().finite().nullable().optional().default(null),
    fechaEnvio: date.nullable().optional().default(null),
    comisionMonto: z.number().finite().nullable().optional().default(null),
    comentarios: text,
    responsableId: crmId,
    seguimientoInicial: z.boolean().optional().default(true),
  })
  .strict();
export const crmAgendaQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    tipo: z.enum(["oportunidad", "lead"]).optional(),
    responsableId: crmId.optional(),
  })
  .strict();
export const crmMonthlyQuery = z
  .object({
    desde: date.optional(),
    hasta: date.optional(),
    dimension: z.enum(["tipo_servicio", "responsable"]).default("tipo_servicio"),
    responsableId: crmId.optional(),
  })
  .strict();
export type CrmListQuery = z.infer<typeof crmListQuery>;
export type CrmCreateProspect = z.infer<typeof crmCreateProspect>;
export type CrmUpdateProspect = z.infer<typeof crmUpdateProspect>;
export type CrmCreateOpportunity = z.infer<typeof crmCreateOpportunity>;
export type CrmUpdateOpportunity = z.infer<typeof crmUpdateOpportunity>;
export type CrmTransition = z.infer<typeof crmTransition>;
export type CrmCreateFollowUp = z.infer<typeof crmCreateFollowUp>;
export type CrmLeadListQuery = z.infer<typeof crmLeadListQuery>;
export type CrmCreateLead = z.infer<typeof crmCreateLead>;
export type CrmUpdateLead = z.infer<typeof crmUpdateLead>;
export type CrmLeadTransition = z.infer<typeof crmLeadTransition>;
export type CrmCreateLeadFollowUp = z.infer<typeof crmCreateLeadFollowUp>;
export type CrmConvertLead = z.infer<typeof crmConvertLead>;
export type CrmAgendaQuery = z.infer<typeof crmAgendaQuery>;
export type CrmMonthlyQuery = z.infer<typeof crmMonthlyQuery>;
