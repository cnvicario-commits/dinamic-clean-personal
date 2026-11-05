/**
 * Confirms the rendered Compose config selects the image the deploy verified.
 * `docker tag` alone does not change the image Compose will start.
 */
export function normalizeImage(image) {
  return String(image ?? '').replace(/^docker\.io\/(library\/)?/, '')
}

export function assertServiceImage(config, expected) {
  const service = config?.services?.[expected.service]
  if (!service) return { ok: false, reason: 'service' }
  if (normalizeImage(service.image) !== normalizeImage(expected.image)) return { ok: false, reason: 'image' }
  return { ok: true }
}

const invoked = process.argv[1]?.endsWith('assert-service-image.mjs')
if (invoked) {
  const { readFileSync } = await import('node:fs')
  const config = JSON.parse(readFileSync(0, 'utf8'))
  const decision = assertServiceImage(config, {
    service: process.env.SERVICE,
    image: process.env.EXPECTED_IMAGE,
  })
  if (!decision.ok) {
    console.error(`COMPOSE_IMAGE_REJECTED ${decision.reason}`)
    process.exit(1)
  }
  console.log('COMPOSE_IMAGE_ACCEPTED')
}
