import { ApiClientError } from '../api/generated'

export type CompanyWriteBody = {
  nombre: string
  cuit: string
  domicilio: string | null
}

export type CompanyWriter = {
  createCompany(body: CompanyWriteBody): Promise<unknown>
  updateCompany(id: string, body: CompanyWriteBody): Promise<unknown>
  setCompanyStatus(id: string, body: { activo: boolean }): Promise<unknown>
}

export type CompanyWriteResult =
  | { ok: true }
  | { ok: false; message: string }

export function canManageCompanies(role: string | null | undefined) {
  return role === 'admin'
}

export function saveCompany(api: CompanyWriter, body: CompanyWriteBody, id?: string) {
  return id ? api.updateCompany(id, body) : api.createCompany(body)
}

export function saveCompanyStatus(api: CompanyWriter, id: string, activo: boolean) {
  return api.setCompanyStatus(id, { activo })
}

export async function runCompanyWrite(action: () => Promise<unknown>): Promise<CompanyWriteResult> {
  try {
    await action()
    return { ok: true }
  } catch (error) {
    const message = error instanceof ApiClientError ? error.message : 'No se pudo guardar la empresa.'
    return { ok: false, message }
  }
}
