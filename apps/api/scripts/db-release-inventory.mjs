#!/usr/bin/env node
/** Read-only inventory. Loads ENV_FILE. Never prints connection strings. */
import { config as loadDotenv } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectInventory, redact, renderInventory, withReadOnlyClient } from './db-release-lib.mjs'

const apiRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const repoRoot = resolve(apiRoot, '../..')
const envFile = process.env.ENV_FILE
if (!envFile) {
  console.error('ENV_FILE is required')
  process.exit(2)
}
loadDotenv({ path: resolve(envFile), override: true, quiet: true })
const databaseUrl = process.env.DATABASE_URL ?? ''
if (!databaseUrl) {
  console.error('DATABASE_URL is missing from ENV_FILE')
  process.exit(2)
}
const label = process.env.INVENTORY_LABEL ?? 'database'
try {
  const inventory = await withReadOnlyClient(databaseUrl, (client) => collectInventory(client, repoRoot))
  process.stdout.write(renderInventory(label, inventory))
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : 'inventory_failed'))
  process.exit(1)
}
