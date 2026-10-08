import { describe, expect, it } from 'vitest'
import { createProfilesRepository } from '../src/infrastructure/db/profiles-repository.js'
import { createMockDb } from './helpers.js'
import { AppError } from '../src/http/errors/app-error.js'

describe('ProfilesRepository (pool writes — Phase 2D)', () => {
  it('updateNombreCompleto issues parameterized UPDATE and returns row', async () => {
    const calls: { text: string; params?: unknown[] }[] = []
    const db = createMockDb({
      query: async (text, params) => {
        calls.push({ text, params })
        return {
          rows: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              nombre_completo: 'Nuevo',
              rol: 'compras',
              created_at: '2026-01-01',
            },
          ],
          rowCount: 1,
          command: 'UPDATE',
          oid: 0,
          fields: [],
        }
      },
    })
    const repo = createProfilesRepository(db)
    const row = await repo.updateNombreCompleto(
      '22222222-2222-4222-8222-222222222222',
      'Nuevo',
    )
    expect(row.nombre_completo).toBe('Nuevo')
    expect(calls[0]?.text.toLowerCase()).toContain('update public.perfiles')
    expect(calls[0]?.params?.[1]).toBe('Nuevo')
  })

  it('updateNombreCompleto → 404 when no row', async () => {
    const db = createMockDb({
      query: async () => ({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      }),
    })
    const repo = createProfilesRepository(db)
    await expect(
      repo.updateNombreCompleto('22222222-2222-4222-8222-222222222222', 'X'),
    ).rejects.toMatchObject({ status: 404, code: 'not_found' })
  })

  it('upsert uses INSERT … ON CONFLICT', async () => {
    const calls: string[] = []
    const db = createMockDb({
      query: async (text) => {
        calls.push(text)
        return {
          rows: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              nombre_completo: 'A',
              rol: 'supervisor',
              created_at: '2026-01-01',
            },
          ],
          rowCount: 1,
          command: 'INSERT',
          oid: 0,
          fields: [],
        }
      },
    })
    const repo = createProfilesRepository(db)
    await repo.upsert({
      id: '33333333-3333-4333-8333-333333333333',
      nombreCompleto: 'A',
      rol: 'supervisor',
    })
    expect(calls[0]?.toLowerCase()).toContain('on conflict')
  })

  it('updateRole maps SQLSTATE 42501 to profile_write_denied', async () => {
    const db = createMockDb({
      query: async () => {
        const err = new Error('permission denied for table perfiles') as Error & { code: string }
        err.code = '42501'
        throw err
      },
    })
    const repo = createProfilesRepository(db)
    try {
      await repo.updateRole('22222222-2222-4222-8222-222222222222', 'admin')
      expect.fail('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).code).toBe('profile_write_denied')
      expect((e as AppError).status).toBe(503)
    }
  })

  it('upsert maps SQLSTATE 23505 to conflict', async () => {
    const db = createMockDb({
      query: async () => {
        const err = new Error('duplicate key') as Error & { code: string }
        err.code = '23505'
        throw err
      },
    })
    const repo = createProfilesRepository(db)
    await expect(
      repo.upsert({
        id: '33333333-3333-4333-8333-333333333333',
        nombreCompleto: 'A',
        rol: 'compras',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })
})
