/**
 * Checks forward migration filenames without a database connection.
 * Prints counts and filenames only.
 */
import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const dir = join(root, 'supabase/migrations/forward')
const names = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()
const apply = names.filter((name) => !name.endsWith('.rollback.sql'))
const versions = new Map()

for (const name of apply) {
  if (!/^[A-Za-z0-9._-]+\.sql$/.test(name)) {
    console.error('MIGRATION_FILES_REJECTED unsafe_name')
    process.exit(1)
  }
  const version = name.split('_')[0]
  if (!/^[0-9]{4,14}$/.test(version)) {
    console.error('MIGRATION_FILES_REJECTED version')
    process.exit(1)
  }
  const previous = versions.get(version)
  if (previous) {
    console.error('MIGRATION_FILES_REJECTED duplicate_version')
    process.exit(1)
  }
  versions.set(version, name)
}

console.log(`migration_files ${apply.length} rollback_files ${names.length - apply.length}`)
