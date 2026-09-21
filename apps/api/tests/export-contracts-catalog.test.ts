import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PERMISSIONS, ROLES } from '../src/domain/rbac-catalog.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = join(root, 'src/domain/rbac-catalog.ts')
const scriptUrl = pathToFileURL(join(root, 'scripts/export-contracts.mjs')).href

describe('export-contracts catalog loader', () => {
  it('parsed rbac-catalog.ts equals runtime ROLES/PERMISSIONS exactly', async () => {
    const mod = await import(scriptUrl)
    const src = readFileSync(catalogPath, 'utf8')
    const parsed = mod.loadRbacCatalogFromSource(src)
    expect(parsed.roles).toEqual([...ROLES])
    expect(parsed.permissions).toEqual([...PERMISSIONS])
  })

  it('does not capture permission-like strings that appear only in comments', async () => {
    const mod = await import(scriptUrl)
    const fake = `
export const ROLES = Object.freeze([
  'admin',
] as const)
export const PERMISSIONS = Object.freeze([
  'profile:read_self',
  // 'comment_only:permission' should be ignored
  'employees:read',
] as const)
`
    const parsed = mod.loadRbacCatalogFromSource(fake)
    expect(parsed.permissions).toEqual(['profile:read_self', 'employees:read'])
    expect(parsed.permissions).not.toContain('comment_only:permission')
  })
})
