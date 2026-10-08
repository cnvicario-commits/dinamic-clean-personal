import { z } from 'zod'
const includeValues = z.enum(['employees', 'clients'])
export const hrCatalogsQuerySchema = z.object({
  include: z.string().transform((value, context) => {
    const values = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
    const parsed = z.array(includeValues).min(1).safeParse(values)
    if (!parsed.success) {
      context.addIssue({ code: 'custom', message: 'include must contain employees and/or clients' })
      return z.NEVER
    }
    return parsed.data
  }),
}).strict()
export const hrCatalogsResponseSchema = z.object({
  employees: z.array(z.object({ id: z.string().uuid(), nombre_apellido: z.string() })),
  clients: z.array(z.object({ id: z.string().uuid(), nombre: z.string() })),
})
export type HrCatalogsResponse = z.infer<typeof hrCatalogsResponseSchema>
export type HrCatalogsQuery = z.infer<typeof hrCatalogsQuerySchema>
