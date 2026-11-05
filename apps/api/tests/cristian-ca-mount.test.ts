import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assessCristianCaFile } from '../../../scripts/assert-cristian-ca-file.mjs'
import { postgresSsl } from '../src/infrastructure/db/pool.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const script = path.join(root, 'scripts/assert-cristian-ca-file.mjs')
const preflight = path.join(root, 'scripts/preflight-cristian-deploy.sh')
const syntax = path.join(root, 'scripts/check-cristian-compose.sh')
const redeploy = path.join(root, 'scripts/redeploy-cristian-api.sh')
const composePath = path.join(root, 'deploy/docker-compose.cristian.yml')

function writeCert(dir: string): string {
  const cert = path.join(dir, 'supabase-ca.crt')
  const key = path.join(dir, 'key.pem')
  const result = spawnSync(
    'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-subj', '/CN=cristian-ca-test', '-days', '1'],
    { encoding: 'utf8' },
  )
  expect(result.status).toBe(0)
  fs.rmSync(key, { force: true })
  return cert
}

function runPreflight(env: NodeJS.ProcessEnv) {
  return spawnSync('bash', [preflight], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', ...env },
  })
}

describe('cristian CA file', () => {
  it('accepts an X.509 certificate and rejects PEM text, keys, and production paths', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cristian-ca-'))
    const file = writeCert(dir)
    expect(assessCristianCaFile(file)).toEqual({ ok: true })

    const fake = path.join(dir, 'headers.crt')
    fs.writeFileSync(fake, '-----BEGIN CERTIFICATE-----\nprobe\n-----END CERTIFICATE-----\n')
    expect(assessCristianCaFile(fake).reason).toBe('not-x509')

    expect(assessCristianCaFile(path.join(dir, 'missing.crt')).reason).toBe('not-found')
    expect(assessCristianCaFile(dir).reason).toBe('not-a-file')
    fs.writeFileSync(path.join(dir, 'empty.crt'), '')
    expect(assessCristianCaFile(path.join(dir, 'empty.crt')).reason).toBe('empty')

    const bundle = path.join(dir, 'bundle.crt')
    fs.writeFileSync(bundle, `${fs.readFileSync(file, 'utf8')}\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n`)
    expect(assessCristianCaFile(bundle).reason).toBe('private-key')

    const link = path.join(dir, 'link.crt')
    fs.symlinkSync(file, link)
    expect(assessCristianCaFile(link).reason).toBe('symlink')
    expect(assessCristianCaFile('/opt/dinamic-clean/certs/supabase-ca.crt').reason).toBe('production-path')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('the CLI rejects a missing file without printing certificate bytes', () => {
    const result = spawnSync(process.execPath, [script, path.join(os.tmpdir(), 'missing-supabase-ca.crt')], {
      encoding: 'utf8',
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('CA_FILE_REJECTED not-found')
    expect(result.stdout).not.toContain('BEGIN CERTIFICATE')
  })
})

describe('cristian deploy preflight', () => {
  it('fails closed before Docker when the CA or TLS policy is not deployable', () => {
    const missing = runPreflight({})
    expect(missing.status).not.toBe(0)
    expect(missing.stderr).toContain('PREFLIGHT_REJECTED missing-CRISTIAN_SUPABASE_CA_FILE')

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cristian-preflight-'))
    const fake = path.join(dir, 'headers.crt')
    fs.writeFileSync(fake, '-----BEGIN CERTIFICATE-----\nprobe\n-----END CERTIFICATE-----\n')
    const envFile = path.join(dir, 'demo.env')
    fs.writeFileSync(envFile, 'NODE_ENV=production\n')
    const base = {
      CRISTIAN_SUPABASE_CA_FILE: fake,
      CRISTIAN_API_HOST_PORT: '3006',
      CRISTIAN_API_CPUS: '1',
      CRISTIAN_API_MEMORY: '512m',
      APP_RELEASE_SHA: 'abc1234',
      CRISTIAN_ENV_FILE: envFile,
    }
    const invalid = runPreflight(base)
    expect(invalid.status).not.toBe(0)
    expect(invalid.stderr).toContain('CA_FILE_REJECTED not-x509')

    const cert = writeCert(dir)
    const disabled = runPreflight({ ...base, CRISTIAN_SUPABASE_CA_FILE: cert, NODE_TLS_REJECT_UNAUTHORIZED: '0' })
    expect(disabled.status).not.toBe(0)
    expect(disabled.stderr).toContain('PREFLIGHT_REJECTED tls_verification_disabled')

    const productionPort = runPreflight({ ...base, CRISTIAN_SUPABASE_CA_FILE: cert, CRISTIAN_API_HOST_PORT: '3005' })
    expect(productionPort.status).not.toBe(0)
    expect(productionPort.stderr).toContain('PREFLIGHT_REJECTED production_port')
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('the recreate script calls preflight before compose up', () => {
    const text = fs.readFileSync(redeploy, 'utf8')
    const syntaxText = fs.readFileSync(syntax, 'utf8')
    expect(text.indexOf('preflight-cristian-deploy.sh')).toBeGreaterThan(-1)
    expect(text.indexOf('preflight-cristian-deploy.sh')).toBeLessThan(text.indexOf('compose'))
    expect(text).toContain('--no-deps')
    expect(text).not.toContain('docker-compose.api.yml')
    expect(syntaxText).toContain('docker_compose_config_is_not_a_deploy_preflight')
    expect(syntaxText).not.toContain('compose up')
  })
})

describe('cristian compose CA mount', () => {
  it('mounts one read-only file and does not create the host path', () => {
    const text = fs.readFileSync(composePath, 'utf8')
    expect(text).toContain('NODE_EXTRA_CA_CERTS: /app/certs/supabase-ca.crt')
    expect(text).toContain('target: /app/certs/supabase-ca.crt')
    expect(text).toContain('read_only: true')
    expect(text).toContain('create_host_path: false')
    expect(text).toContain('${CRISTIAN_SUPABASE_CA_FILE:?')
    expect(text).not.toContain('NODE_TLS_REJECT_UNAUTHORIZED')
    expect(text).not.toContain('rejectUnauthorized')
  })
})

describe('published postgres TLS', () => {
  it('keeps rejectUnauthorized enabled for a production Supabase connection', () => {
    expect(
      postgresSsl(
        'postgresql://dinamic_api.edruejzwwnixsjsadbgb:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres',
        'production',
      ),
    ).toEqual({ rejectUnauthorized: true })
    expect(postgresSsl('postgresql://dinamic_api:secret@127.0.0.1:54322/postgres', 'production')).toBeUndefined()
  })
})
