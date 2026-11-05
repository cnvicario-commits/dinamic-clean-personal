/**
 * Fails the Cristian image build if the production project ref was baked in.
 * Does not print file contents.
 */
import fs from 'node:fs'
import path from 'node:path'

const PRODUCTION_REF = 'biectbcujabpjhinouil'
const TEST_REF = 'edruejzwwnixsjsadbgb'
const roots = ['.next/static', '.next/standalone']

function filesUnder(dir, found = []) {
  if (!fs.existsSync(dir)) return found
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) filesUnder(full, found)
    else if (entry.isFile()) found.push(full)
  }
  return found
}

function scan() {
  const files = roots.flatMap((root) => filesUnder(root))
  if (files.length === 0) return 'bundle-missing'
  let sawTest = false
  for (const file of files) {
    const text = fs.readFileSync(file)
    if (text.includes(PRODUCTION_REF)) return 'bundle-contains-production'
    if (text.includes('SUPABASE_SERVICE_ROLE_KEY=') || text.includes('DATABASE_URL=') || text.includes('MIGRATIONS_DATABASE_URL=')) {
      return 'bundle-contains-server-secret'
    }
    if (file.startsWith('.next/static') && text.includes(TEST_REF)) sawTest = true
  }
  if (!sawTest) return 'bundle-missing-test-project'
  return null
}

const reason = scan()
if (reason) {
  console.error(`CRISTIAN_FRONTEND_REJECTED ${reason}`)
  process.exit(1)
}
console.log('CRISTIAN_FRONTEND_BUNDLE_OK')
