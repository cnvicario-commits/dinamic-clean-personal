/**
 * Checks the Supabase CA file mounted into the Cristian API.
 * A PEM header is not enough: OpenSSL must parse an X.509 certificate.
 * Prints a reason, never the certificate body.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PRODUCTION_ROOT = '/opt/dinamic-clean/'

function opensslReadsCertificate(filePath) {
  try {
    execFileSync('openssl', ['x509', '-in', filePath, '-noout'], { stdio: 'ignore' })
    return true
  } catch (error) {
    if (error && error.code === 'ENOENT') return 'missing-openssl'
    return false
  }
}

export function assessCristianCaFile(filePath) {
  const value = String(filePath ?? '').trim()
  if (!value) return { ok: false, reason: 'missing-path' }
  if (value.includes('\0') || value.split(path.sep).includes('..')) {
    return { ok: false, reason: 'path-traversal' }
  }
  const resolved = path.resolve(value)
  if (resolved === '/opt/dinamic-clean' || resolved.startsWith(PRODUCTION_ROOT)) {
    return { ok: false, reason: 'production-path' }
  }
  let stat
  try {
    stat = fs.lstatSync(resolved)
  } catch {
    return { ok: false, reason: 'not-found' }
  }
  if (stat.isSymbolicLink()) return { ok: false, reason: 'symlink' }
  if (!stat.isFile()) return { ok: false, reason: 'not-a-file' }
  if (stat.size <= 0) return { ok: false, reason: 'empty' }
  const text = fs.readFileSync(resolved, 'utf8')
  if (text.includes('PRIVATE KEY')) return { ok: false, reason: 'private-key' }
  const parsed = opensslReadsCertificate(resolved)
  if (parsed === 'missing-openssl') return { ok: false, reason: 'openssl-unavailable' }
  if (!parsed) return { ok: false, reason: 'not-x509' }
  return { ok: true }
}

const invokedDirectly = process.argv[1]?.endsWith('assert-cristian-ca-file.mjs')
if (invokedDirectly) {
  const result = assessCristianCaFile(process.argv[2])
  if (!result.ok) {
    console.error(`CA_FILE_REJECTED ${result.reason}`)
    process.exit(1)
  }
  console.log('CA_FILE_OK')
}
