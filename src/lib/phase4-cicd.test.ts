import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))

function nodeScript(script: string, input = '') {
  return spawnSync('node', [script], {
    cwd: root,
    input,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
  })
}

describe('phase 4 workflow isolation', () => {
  it('accepts the committed workflows', () => {
    const result = nodeScript('scripts/ci/check-workflow-isolation.mjs')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('workflow_isolation_ok')
  })

  it('checks migration filenames without a database', () => {
    const result = nodeScript('scripts/ci/check-forward-migration-files.mjs')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('migration_files 28')
  })

  it('selects only the service whose files changed', () => {
    const api = nodeScript('scripts/ci/select-cristian-services.mjs', 'apps/api/src/app.ts\n')
    const frontend = nodeScript('scripts/ci/select-cristian-services.mjs', 'src/app/login/page.tsx\n')
    const none = nodeScript('scripts/ci/select-cristian-services.mjs', 'docs/architecture-audit/phase-4/01-current-state.md\n')
    expect(api.stdout).toBe('services=api\n')
    expect(frontend.stdout).toBe('services=frontend\n')
    expect(none.stdout).toBe('services=none\n')
  })
})
