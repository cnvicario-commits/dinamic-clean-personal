import 'dotenv/config'
import { loadEnv } from './config/env.js'
import { buildApp } from './app.js'

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
