import { describe, expect, it } from 'vitest'
import { probePhase3aCapabilities } from '../src/infrastructure/db/phase3a-capabilities.js'

function capabilityQuery(overrides: { browserDml?: boolean } = {}) {
  return async <T extends Record<string, unknown>>(sql: string): Promise<{ rows: T[] }> => {
    if (sql.startsWith('select current_user')) return { rows: [{ current_user: 'dinamic_api', current_schema: 'public' } as T] }
    if (sql.includes('rolsuper')) return { rows: [{ rolsuper: false, rolbypassrls: false } as T] }
    if (sql.includes('information_schema.tables')) {
      return { rows: ['perfiles', 'clientes', 'empleados', 'asignaciones'].map((table_name) => ({ table_name }) as T) }
    }
    if (sql.includes('information_schema.column_privileges')) {
      const rows = [
        ['empleados', 'SELECT', null], ['empleados', 'INSERT', 'nombre_apellido'], ['empleados', 'INSERT', 'cuil'],
        ['empleados', 'INSERT', 'legajo'], ['empleados', 'INSERT', 'fecha_ingreso'], ['empleados', 'INSERT', 'horas_contrato'],
        ['empleados', 'INSERT', 'empresa'], ['empleados', 'UPDATE', 'activo'], ['asignaciones', 'SELECT', null],
        ['asignaciones', 'INSERT', 'empleado_id'], ['asignaciones', 'INSERT', 'cliente_id'], ['asignaciones', 'INSERT', 'fecha_desde'],
        ['asignaciones', 'UPDATE', 'fecha_hasta'], ['clientes', 'SELECT', null],
      ].map(([table_name, privilege_type, column_name]) => ({ table_name, privilege_type, column_name }) as T)
      return { rows }
    }
    if (sql.includes('role_table_grants')) {
      if (sql.includes('grantee = current_user')) {
        return { rows: ['empleados', 'asignaciones', 'clientes'].map((table_name) => ({ table_name }) as T) }
      }
      return { rows: (overrides.browserDml ? [{ grantee: 'authenticated', table_name: 'empleados', privilege_type: 'INSERT' }] : []) as T[] }
    }
    if (sql.includes('pg_policy')) {
      return {
        rows: [
          ['empleados', 'empleados_dinamic_api_select', 'r'], ['empleados', 'empleados_dinamic_api_insert', 'a'],
          ['empleados', 'empleados_dinamic_api_update', 'w'], ['asignaciones', 'asignaciones_dinamic_api_select', 'r'],
          ['asignaciones', 'asignaciones_dinamic_api_insert', 'a'], ['asignaciones', 'asignaciones_dinamic_api_update', 'w'],
        ].map(([tablename, policyname, cmd]) => ({ tablename, policyname, cmd, roles: ['dinamic_api'] }) as T),
      }
    }
    if (sql.includes('pg_class')) {
      return { rows: [{ relname: 'empleados', relrowsecurity: true }, { relname: 'asignaciones', relrowsecurity: true }] as T[] }
    }
    return { rows: [] }
  }
}

describe('Phase 3A DB compatibility gate', () => {
  it('accepts the complete materialized contract', async () => {
    await expect(probePhase3aCapabilities(capabilityQuery())).resolves.toMatchObject({ ok: true, currentUser: 'dinamic_api' })
  })

  it('rejects browser DML drift', async () => {
    await expect(probePhase3aCapabilities(capabilityQuery({ browserDml: true }))).resolves.toMatchObject({
      ok: false,
      reason: 'browser_dml_privilege_present',
    })
  })
})
