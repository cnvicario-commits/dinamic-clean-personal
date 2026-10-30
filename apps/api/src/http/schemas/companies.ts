import { z } from 'zod'
import { postgresUuid } from './postgres-uuid.js'

export const companyBodyOpenApiSchema = z
  .object({
    nombre: z.string().trim().min(1).max(300),
    cuit: z.string().trim().min(1).max(50),
    domicilio: z.union([z.string().trim().max(500), z.null()]).optional(),
  })
  .strict()

export const companyBodySchema = companyBodyOpenApiSchema.transform((body) => ({
  ...body,
  domicilio: body.domicilio && body.domicilio.length > 0 ? body.domicilio : null,
}))

export const updateCompanyBodyOpenApiSchema = z
  .object({
    nombre: z.string().trim().min(1).max(300).optional(),
    cuit: z.string().trim().min(1).max(50).optional(),
    domicilio: z.union([z.string().trim().max(500), z.null()]).optional(),
  })
  .strict()

export const updateCompanyBodySchema = updateCompanyBodyOpenApiSchema
  .transform((body) => {
    const patch: { nombre?: string; cuit?: string; domicilio?: string | null } = {}
    if (body.nombre !== undefined) patch.nombre = body.nombre
    if (body.cuit !== undefined) patch.cuit = body.cuit
    if (body.domicilio !== undefined) {
      patch.domicilio = body.domicilio && body.domicilio.length > 0 ? body.domicilio : null
    }
    return patch
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' })

export const updateCompanyStatusBodySchema = z.object({ activo: z.boolean() }).strict()
export const companyIdParamsSchema = z.object({ id: postgresUuid }).strict()

export const companySchema = z.object({
  id: postgresUuid,
  nombre: z.string(),
  cuit: z.string().nullable(),
  domicilio: z.string().nullable(),
  activo: z.boolean(),
})

export type CompanyBody = z.infer<typeof companyBodySchema>
export type UpdateCompanyBody = z.infer<typeof updateCompanyBodySchema>
export type UpdateCompanyStatusBody = z.infer<typeof updateCompanyStatusBodySchema>
export type Company = z.infer<typeof companySchema>
