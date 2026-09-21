import { config as loadDotenv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './config/env.js'
import { buildApp } from './app.js'

/**
 * Load env from apps/api/.env first, then monorepo root `.env` / `.env.local`
 * (Next keeps SUPABASE_SERVICE_ROLE_KEY in root `.env.local`).
 * Existing process.env wins (dotenv does not override by default).
 */
const here = dirname(fileURLToPath(import.meta.url))
const apiRoot = resolve(here, '..') // apps/api
const repoRoot = resolve(apiRoot, '../..') // monorepo root (apps/api → apps → root)
for (const path of [
  resolve(apiRoot, '.env'),
  resolve(apiRoot, '.env.local'),
  resolve(repoRoot, '.env'),
  resolve(repoRoot, '.env.local'),
]) {
  loadDotenv({ path })
}

async function main() {
  const env = loadEnv()
  const app = await buildApp(env)

  let shuttingDown = false

  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true

    app.log.info({ signal, timeoutMs: env.SHUTDOWN_TIMEOUT_MS }, 'shutting down')

    const forceTimer = setTimeout(() => {
      app.log.error({ timeoutMs: env.SHUTDOWN_TIMEOUT_MS }, 'shutdown timeout exceeded')
      process.exit(1)
    }, env.SHUTDOWN_TIMEOUT_MS)
    forceTimer.unref()

    try {
      await app.close()
      clearTimeout(forceTimer)
      process.exit(0)
    } catch (err) {
      clearTimeout(forceTimer)
      app.log.error({ err }, 'shutdown error')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  await app.listen({ host: env.HOST, port: env.PORT })
}

main().catch((err) => {
  // Startup failures: print message only (no secrets)
  console.error(err instanceof Error ? err.message : 'Fatal startup error')
  process.exit(1)
})
