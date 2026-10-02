import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'
import { createProfileStubDb, signAccessToken, testEnv } from './helpers.js'
import type { AttendanceRepository } from '../src/infrastructure/db/attendance-repository.js'
import type { AttendanceJustificationsStorage } from '../src/infrastructure/storage/attendance-justifications-storage.js'
import { notFound } from '../src/http/errors/app-error.js'

const USER = '22222222-2222-4222-8222-222222222222'
const ATT = '33333333-3333-4333-8333-333333333333'
const apps: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

function attendanceRepo(): AttendanceRepository {
  return {
    list: vi.fn(async () => ({ items: [], page: 1, pageSize: 25, total: 0 })),
    upsert: vi.fn(async () => ({
      id: ATT,
      empleadoId: 'e',
      fecha: '2026-09-01',
      codigo: 'P',
      horasExtras: 0,
      cargadoPor: USER,
      createdAt: '2026-01-01',
      observaciones: null,
      hasJustification: false,
      clienteDestinoId: null,
      clienteHorasExtraId: null,
      empleadoNombre: 'Ana',
    })),
    listCodes: vi.fn(async () => [{ codigo: 'P', descripcion: 'Presente', codigoBejerman: null, cuentaComoAusencia: false }]),
    getById: vi.fn(async () => ({
      id: ATT,
      empleadoId: 'e',
      archivoUrl: null,
      archivoStoragePath: `${ATT}/file.pdf`,
    })),
    setJustificationStoragePath: vi.fn(async () => undefined),
    clearJustification: vi.fn(async () => ({ archivoUrl: null, archivoStoragePath: `${ATT}/file.pdf` })),
    restoreJustification: vi.fn(async () => undefined),
  } as unknown as AttendanceRepository
}

const storage: AttendanceJustificationsStorage = {
  upload: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  signedUrl: vi.fn(async () => 'https://signed.example/x'),
}

async function app(role: string, repo = attendanceRepo()) {
  const instance = await buildApp(testEnv(), {
    db: createProfileStubDb({ profile: { id: USER, nombre_completo: 'User', rol: role } }),
    attendanceRepo: repo,
    attendanceJustificationsStorage: storage,
  })
  apps.push(instance)
  await instance.ready()
  return instance
}

async function auth() {
  return { authorization: `Bearer ${await signAccessToken({ sub: USER })}` }
}

describe('Phase 6A attendance justification HTTP', () => {
  it('requires authentication', async () => {
    const a = await app('admin')
    expect((await a.inject({ method: 'POST', url: `/v1/attendance/${ATT}/justification`, payload: {} })).statusCode).toBe(401)
  })

  it('uploads with attendance:update and downloads with attendance:read', async () => {
    const a = await app('gerente')
    const headers = await auth()
    const contentBase64 = Buffer.from('%PDF-1.7\n%%EOF').toString('base64')
    const upload = await a.inject({
      method: 'POST',
      url: `/v1/attendance/${ATT}/justification`,
      headers,
      payload: { fileName: 'just.pdf', contentBase64 },
    })
    expect(upload.statusCode).toBe(201)
    const download = await a.inject({
      method: 'GET',
      url: `/v1/attendance/${ATT}/justification/download`,
      headers,
    })
    expect(download.statusCode).toBe(200)
    expect(download.json()).toMatchObject({ url: 'https://signed.example/x', legacy: false })
  })

  it('rejects client archivoUrl on attendance upsert', async () => {
    const a = await app('gerente')
    const headers = await auth()
    const response = await a.inject({
      method: 'PUT',
      url: '/v1/attendance',
      headers,
      payload: {
        empleadoId: '11111111-1111-4111-8111-111111111111',
        fecha: '2026-09-01',
        codigo: 'P',
        archivoUrl: 'https://evil.example/x',
      },
    })
    expect(response.statusCode).toBe(400)
  })

  it('denies supervisor on upload', async () => {
    const a = await app('supervisor')
    const headers = await auth()
    const contentBase64 = Buffer.from('%PDF-1.7\n%%EOF').toString('base64')
    expect(
      (
        await a.inject({
          method: 'POST',
          url: `/v1/attendance/${ATT}/justification`,
          headers,
          payload: { fileName: 'just.pdf', contentBase64 },
        })
      ).statusCode,
    ).toBe(403)
  })

  it('returns not found for missing justification on download', async () => {
    const repo = attendanceRepo()
    vi.mocked(repo.getById).mockRejectedValue(notFound('Attendance record not found'))
    const a = await app('gerente', repo)
    const headers = await auth()
    const response = await a.inject({
      method: 'GET',
      url: `/v1/attendance/${ATT}/justification/download`,
      headers,
    })
    expect(response.statusCode).toBe(404)
  })
})
