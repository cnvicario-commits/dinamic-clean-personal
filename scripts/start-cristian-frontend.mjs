import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { assessCristianFrontendEnv } from './assert-cristian-frontend-env.mjs'

const manifestPath = path.join(process.cwd(), 'cristian-frontend-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const result = assessCristianFrontendEnv(process.env, 'runtime', manifest)
if (!result.ok) {
  console.error(`CRISTIAN_FRONTEND_REJECTED ${result.reason}`)
  process.exit(1)
}

const child = spawn(process.execPath, ['server.js'], { stdio: 'inherit' })
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal)
  })
}
child.on('exit', (code, signal) => {
  if (signal || code === 143 || code === 130) process.exit(0)
  process.exit(code ?? 1)
})
