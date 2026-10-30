import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../api/generated'
import { canManageCompanies, runCompanyWrite, saveCompany, saveCompanyStatus, type CompanyWriter } from './company-writes'

const body = { nombre: 'ACME', cuit: '30-1', domicilio: null }

function writer(): CompanyWriter {
  return {
    createCompany: vi.fn(async () => ({ id: '1' })),
    updateCompany: vi.fn(async () => ({ id: '1' })),
    setCompanyStatus: vi.fn(async () => ({ id: '1' })),
  }
}

describe('company writes', () => {
  it('creates, updates and changes status through the API client', async () => {
    const api = writer()
    await saveCompany(api, body)
    await saveCompany(api, body, 'company-1')
    await saveCompanyStatus(api, 'company-1', false)
    expect(api.createCompany).toHaveBeenCalledWith(body)
    expect(api.updateCompany).toHaveBeenCalledWith('company-1', body)
    expect(api.setCompanyStatus).toHaveBeenCalledWith('company-1', { activo: false })
  })

  it('returns the API error and does not report success', async () => {
    const result = await runCompanyWrite(async () => {
      throw new ApiClientError('Company not found', 404, 'req-1')
    })
    expect(result).toEqual({ ok: false, message: 'Company not found' })
  })

  it('reports success only after the request resolves', async () => {
    await expect(runCompanyWrite(async () => ({ id: '1' }))).resolves.toEqual({ ok: true })
  })

  it('lets only admin manage companies', () => {
    expect(canManageCompanies('admin')).toBe(true)
    for (const role of ['gerente', 'compras', 'supervisor', 'auditoria', 'ventas', null, undefined]) {
      expect(canManageCompanies(role)).toBe(false)
    }
  })

  it('keeps the empresas screens off direct PostgREST writes', () => {
    const root = resolve(import.meta.dirname, '../../..')
    for (const file of ['src/components/EmpresaForm.tsx', 'src/components/EmpresaEstadoBoton.tsx']) {
      const source = readFileSync(resolve(root, file), 'utf8')
      expect(source).not.toMatch(/supabase\.from\(['"]empresas['"]\)/)
      expect(source).not.toMatch(/\.(insert|update|delete|upsert)\(/)
      expect(source).toMatch(/runCompanyWrite/)
    }
    const panel = readFileSync(resolve(root, 'src/components/EmpresasPanel.tsx'), 'utf8')
    const table = readFileSync(resolve(root, 'src/components/EmpresasTabla.tsx'), 'utf8')
    expect(panel).toMatch(/canWrite/)
    expect(table).toMatch(/canWrite/)
    expect(readFileSync(resolve(root, 'src/app/empresas/page.tsx'), 'utf8')).toMatch(/canManageCompanies/)
  })
})