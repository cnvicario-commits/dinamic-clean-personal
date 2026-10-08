import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CATALOG_IMPORT_MAX_ROWS,
  RESULTS_IMPORT_MAX_ROWS,
} from '../src/domain/import-limits.js'
import { articleImportBody, priceListBody } from '../src/http/schemas/catalog.js'
import { reportDateRangeQuerySchema } from '../src/http/schemas/hr-reports.js'
import { importBody } from '../src/http/schemas/purchases.js'
import { resultsImport } from '../src/http/schemas/results.js'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))

describe('phase 6B import limits', () => {
  it('rejects catalog imports above the shared row cap', () => {
    const rows = Array.from({ length: CATALOG_IMPORT_MAX_ROWS + 1 }, (_, i) => ({
      fila: i + 2,
      nombre: `A-${i}`,
    }))
    expect(articleImportBody.safeParse({ rows }).success).toBe(false)
    expect(priceListBody.safeParse({
      proveedorId: '33333333-3333-4333-8333-333333333333',
      archivoOrigen: 'x.xlsx',
      rows: rows.map((r, i) => ({
        fila: r.fila,
        codigoProveedor: `P-${i}`,
        nombreProveedor: 'N',
        precio: 1,
      })),
    }).success).toBe(false)
  })

  it('rejects results imports above the monthly period cap', () => {
    const row = {
      anio: 2026,
      mes: 1,
      values: { total_ventas: 1 },
      details: [],
    }
    const rows = Array.from({ length: RESULTS_IMPORT_MAX_ROWS + 1 }, () => row)
    expect(resultsImport.safeParse({ rows }).success).toBe(false)
  })

  it('preserves purchase matrix order and per-order item limits', () => {
    const item = { articuloId: '44444444-4444-4444-8444-444444444444', cantidad: 1 }
    const order = {
      clienteId: '33333333-3333-4333-8333-333333333333',
      items: [item],
    }
    expect(importBody.safeParse({
      empresaId: '22222222-2222-4222-8222-222222222222',
      orders: Array.from({ length: 501 }, () => order),
    }).success).toBe(false)
    expect(importBody.safeParse({
      empresaId: '22222222-2222-4222-8222-222222222222',
      orders: [{ ...order, items: Array.from({ length: 501 }, () => item) }],
    }).success).toBe(false)
  })
})

describe('phase 6B HR report ranges', () => {
  it('accepts valid ranges without imposing an undocumented maximum span', () => {
    expect(reportDateRangeQuerySchema.safeParse({ from: '2026-09-01', to: '2026-09-30' }).success).toBe(true)
    expect(reportDateRangeQuerySchema.safeParse({ from: '2026-01-01', to: '2026-04-01' }).success).toBe(true)
  })
})

describe('phase 6B attendance export UX', () => {
  it('does not prefetch all attendance pages on ausencias mount', () => {
    const src = readFileSync(`${repoRoot}/src/app/ausencias/page.tsx`, 'utf8')
    expect(src).not.toMatch(/allAttendance\s*\(/)
    expect(src).not.toContain('exportItems')
  })

  it('loads attendance for export only from ExportarAusencias', () => {
    const src = readFileSync(`${repoRoot}/src/components/ExportarAusencias.tsx`, 'utf8')
    expect(src).toContain('fetchAllPages')
    expect(src).toContain('listAttendance')
  })
})
