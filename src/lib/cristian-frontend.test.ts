import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { assessCristianFrontendEnv, cristianFrontendUsesStandalone } from '../../scripts/assert-cristian-frontend-env.mjs'

const root = fileURLToPath(new URL('../..', import.meta.url))
const anon = 'sb_publishable_cristian_probe'
const serviceJwt = [
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'),
  'probe',
].join('.')

function env(overrides: Record<string, string> = {}) {
  return {
    APP_DEPLOYMENT_ENV: 'cristian-pruebas',
    NODE_ENV: 'production',
    CRISTIAN_FRONTEND_BUILD: '1',
    APP_RELEASE_SHA: 'abc1234',
    NEXT_PUBLIC_SUPABASE_URL: 'https://edruejzwwnixsjsadbgb.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    NEXT_PUBLIC_API_URL: 'https://pruebas.dinamic-clean.com',
    ...overrides,
  }
}

function run(script: string, envOverrides: Record<string, string>) {
  return spawnSync('bash', [path.join(root, script)], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test', ...envOverrides },
  })
}

describe('cristian frontend environment', () => {
  it('accepts Supabase Test and rejects production, secrets, and placeholder origins', () => {
    expect(assessCristianFrontendEnv(env(), 'build')).toEqual({ ok: true, reason: '' })
    expect(cristianFrontendUsesStandalone({ CRISTIAN_FRONTEND_BUILD: '1', NODE_ENV: 'production' })).toBe(true)
    expect(cristianFrontendUsesStandalone({ NODE_ENV: 'production' })).toBe(false)
    expect(
      assessCristianFrontendEnv(env({ NEXT_PUBLIC_SUPABASE_URL: 'https://biectbcujabpjhinouil.supabase.co' }), 'build').reason,
    ).toBe('supabase-url-not-test')
    expect(assessCristianFrontendEnv(env({ NEXT_PUBLIC_SUPABASE_ANON_KEY: serviceJwt }), 'build').reason).toBe('anon-key-is-secret')
    expect(assessCristianFrontendEnv(env({ DATABASE_URL: 'postgresql://dinamic_api@127.0.0.1/postgres' }), 'build').reason).toBe(
      'forbidden-DATABASE_URL',
    )
    expect(assessCristianFrontendEnv(env({ NEXT_PUBLIC_API_URL: 'http://170.239.85.196:3006' }), 'deploy')).toEqual({
      ok: true,
      reason: '',
    })
    expect(assessCristianFrontendEnv(env({ NEXT_PUBLIC_API_URL: 'http://8.8.8.8:3006' }), 'deploy').reason).toBe(
      'browser-api-url-not-https',
    )
    expect(assessCristianFrontendEnv(env({ NEXT_PUBLIC_API_URL: 'http://170.239.85.196:3005' }), 'deploy').reason).toBe(
      'browser-api-url-not-https',
    )
    expect(assessCristianFrontendEnv(env({ NEXT_PUBLIC_API_URL: 'http://localhost:3006' }), 'build').reason).toBe(
      'browser-api-url-not-https',
    )
    expect(assessCristianFrontendEnv(env({ NEXT_PUBLIC_API_URL: 'https://demo.example.com' }), 'deploy').reason).toBe(
      'browser-api-url-not-deployable',
    )
    expect(assessCristianFrontendEnv(env({ NEXT_PUBLIC_API_URL: 'https://cristian-frontend.invalid' }), 'build')).toEqual({ ok: true, reason: '' })
    expect(assessCristianFrontendEnv(env({ NEXT_PUBLIC_API_URL: 'https://cristian-frontend.invalid' }), 'deploy').reason).toBe(
      'browser-api-url-not-deployable',
    )
    expect(assessCristianFrontendEnv(env({ API_URL: 'http://dinamic-clean-cristian-api:3001' }), 'runtime', {
      supabaseUrl: 'https://edruejzwwnixsjsadbgb.supabase.co',
      apiUrl: 'https://pruebas.dinamic-clean.com',
      release: 'abc1234',
    })).toEqual({ ok: true, reason: '' })
    expect(assessCristianFrontendEnv(env({ API_URL: 'http://127.0.0.1:3006' }), 'build').reason).toBe('server-api-url-not-allowed')
  })

  it('rejects public URL drift after the image was built', () => {
    expect(assessCristianFrontendEnv(env(), 'runtime', {
      supabaseUrl: 'https://edruejzwwnixsjsadbgb.supabase.co',
      apiUrl: 'https://otro.dinamic-clean.com',
      release: 'abc1234',
    }).reason).toBe('public-api-url-drift')
  })
})

describe('cristian frontend deploy scripts', () => {
  it('fails closed before Docker when the public origin or port is not deployable', () => {
    const missing = run('scripts/preflight-cristian-frontend.sh', {})
    expect(missing.status).not.toBe(0)
    expect(missing.stderr).toContain('PREFLIGHT_REJECTED missing-CRISTIAN_NEXT_PUBLIC_SUPABASE_URL')

    const base = {
      CRISTIAN_NEXT_PUBLIC_SUPABASE_URL: 'https://edruejzwwnixsjsadbgb.supabase.co',
      CRISTIAN_NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
      CRISTIAN_NEXT_PUBLIC_API_URL: 'https://cristian-frontend.invalid',
      CRISTIAN_FRONTEND_HOST_PORT: '8086',
      CRISTIAN_FRONTEND_CPUS: '0.5',
      CRISTIAN_FRONTEND_MEMORY: '512m',
      APP_RELEASE_SHA: 'abc1234',
    }
    const probe = run('scripts/preflight-cristian-frontend.sh', base)
    expect(probe.status).not.toBe(0)
    expect(probe.stderr).toContain('CRISTIAN_FRONTEND_REJECTED browser-api-url-not-deployable')
    expect(probe.stdout).not.toContain(anon)
    expect(probe.stderr).not.toContain(anon)

    const wrongPort = run('scripts/preflight-cristian-frontend.sh', {
      ...base,
      CRISTIAN_NEXT_PUBLIC_API_URL: 'http://170.239.85.196:3006',
      CRISTIAN_FRONTEND_HOST_PORT: '18086',
    })
    expect(wrongPort.status).not.toBe(0)
    expect(wrongPort.stderr).toContain('PREFLIGHT_REJECTED frontend_port')

    const productionPort = run('scripts/preflight-cristian-frontend.sh', {
      ...base,
      CRISTIAN_NEXT_PUBLIC_API_URL: 'https://pruebas.dinamic-clean.com',
      CRISTIAN_FRONTEND_HOST_PORT: '3005',
    })
    expect(productionPort.status).not.toBe(0)
    expect(productionPort.stderr).toContain('PREFLIGHT_REJECTED reserved_port')
  })

  it('the frontend recreate script cannot remove the API', () => {
    const text = fs.readFileSync(path.join(root, 'scripts/redeploy-cristian-frontend.sh'), 'utf8')
    const syntax = fs.readFileSync(path.join(root, 'scripts/check-cristian-frontend-compose.sh'), 'utf8')
    const proxy = fs.readFileSync(path.join(root, 'src/proxy.ts'), 'utf8')
    const server = fs.readFileSync(path.join(root, 'src/lib/api/server.ts'), 'utf8')
    expect(text.indexOf('preflight-cristian-frontend.sh')).toBeLessThan(text.indexOf('docker compose'))
    expect(text).toContain('--no-deps')
    expect(text).toContain('--no-build')
    expect(text).toContain('force-recreate frontend')
    expect(text).not.toContain('--remove-orphans')
    expect(text).not.toContain('docker-compose.cristian.yml')
    expect(syntax).toContain('docker_compose_config_is_not_a_deploy_preflight')
    expect(proxy).toContain('api/healthz')
    expect(server).toContain('process.env.API_URL??process.env.NEXT_PUBLIC_API_URL')
  })

  it('renders a frontend vhost without installing it', () => {
    const result = spawnSync('bash', [path.join(root, 'deploy/render-cristian-frontend-nginx.sh')], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH ?? '',
        CRISTIAN_FRONTEND_DOMAIN: 'pruebas.dinamic-clean.com',
        CRISTIAN_FRONTEND_HOST_PORT: '8086',
        NODE_ENV: 'test',
      },
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('server_name pruebas.dinamic-clean.com')
    expect(result.stdout).toContain('proxy_pass http://127.0.0.1:8086')
    expect(result.stdout).not.toContain('__CRISTIAN_FRONTEND_')

    const rejected = spawnSync('bash', [path.join(root, 'deploy/render-cristian-frontend-nginx.sh')], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH ?? '',
        NODE_ENV: 'test',
        CRISTIAN_FRONTEND_DOMAIN: 'demo.example.com',
        CRISTIAN_FRONTEND_HOST_PORT: '8086',
      },
    })
    expect(rejected.status).not.toBe(0)
  })
})

describe('cristian frontend bundle scan', () => {
  it('rejects a build output that contains the production project', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cristian-bundle-'))
    const previous = process.cwd()
    fs.mkdirSync(path.join(dir, '.next/static'), { recursive: true })
    fs.mkdirSync(path.join(dir, '.next/standalone'), { recursive: true })
    fs.writeFileSync(path.join(dir, '.next/static/app.js'), 'https://edruejzwwnixsjsadbgb.supabase.co')
    fs.writeFileSync(path.join(dir, '.next/standalone/server.js'), 'ok')
    const script = path.join(root, 'scripts/scan-cristian-frontend-bundle.mjs')
    const clean = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' })
    expect(clean.status).toBe(0)
    fs.writeFileSync(path.join(dir, '.next/static/leak.js'), 'biectbcujabpjhinouil')
    const leaked = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' })
    expect(leaked.status).not.toBe(0)
    expect(leaked.stderr).toContain('bundle-contains-production')
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
