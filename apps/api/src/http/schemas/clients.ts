import { z } from 'zod'

const nullableText = z.string().trim().max(500).nullable().optional().default(null)
export const clientIdSchema = z.object({ id: z.string().uuid() }).strict()
export const createClientBodySchema = z.object({
  nombre: z.string().trim().min(1).max(300), cuit: nullableText, personaContacto: nullableText,
  codigoCostos: nullableText, presupuesto4hs: z.number().int().min(0).default(0),
  presupuesto8hs: z.number().int().min(0).default(0), domicilio: nullableText,
  llevaInsumos: z.boolean().nullable().optional().default(false),
}).strict()
export const updateClientBodySchema = createClientBodySchema.partial().extend({ activo: z.boolean().optional() }).strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
export const createAddressBodySchema = z
  .object({
    alias: z.string().trim().min(1).max(200),
    direccion: nullableText,
    horarioAtencion: nullableText,
    esPrincipal: z.boolean().optional().default(false),
  })
  .strict()
export const updateAddressBodySchema = createAddressBodySchema.partial().strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
export const statusBodySchema = z.object({ activo:z.boolean() }).strict()
export const quoteUploadBodySchema = z.object({
  fileName:z.string().trim().min(1).max(255),
  contentBase64:z.string().min(1).max(21_000_000),
}).strict()
export const idempotencyKeySchema=z.string().trim().min(1).max(255)
export type CreateClientBody=z.infer<typeof createClientBodySchema>
export type UpdateClientBody=z.infer<typeof updateClientBodySchema>
export type CreateAddressBody=z.infer<typeof createAddressBodySchema>
export type UpdateAddressBody=z.infer<typeof updateAddressBodySchema>
