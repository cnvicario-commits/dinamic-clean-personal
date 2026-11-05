/**
 * Reads changed paths on stdin and prints one GitHub output line:
 * services=api|frontend|both|none
 */
const api = [
  /^apps\/api\//,
  /^deploy\/docker-compose\.cristian\.yml$/,
  /^scripts\/(preflight-cristian-deploy|redeploy-cristian-api|assert-cristian-ca-file|assert-cristian-compose-render|check-cristian-compose)\./,
]
const frontend = [
  /^(src|public)\//,
  /^(package\.json|package-lock\.json|next\.config\.ts|tsconfig\.json)$/,
  /^deploy\/(Dockerfile\.frontend|docker-compose\.cristian-frontend\.yml)$/,
  /^scripts\/(assert-cristian-frontend|preflight-cristian-frontend|redeploy-cristian-frontend|start-cristian-frontend|scan-cristian-frontend)/,
]

const chunks = []
process.stdin.on('data', (chunk) => chunks.push(chunk))
process.stdin.on('end', () => {
  const paths = Buffer.concat(chunks).toString('utf8').split('\n').map((line) => line.trim()).filter(Boolean)
  const apiChanged = paths.some((path) => api.some((pattern) => pattern.test(path)))
  const frontendChanged = paths.some((path) => frontend.some((pattern) => pattern.test(path)))
  const services = apiChanged && frontendChanged ? 'both' : apiChanged ? 'api' : frontendChanged ? 'frontend' : 'none'
  process.stdout.write(`services=${services}\n`)
})
