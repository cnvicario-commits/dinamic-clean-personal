/** Short label for the deployed git SHA shown in the Cristian demo banner. */
function formatReleaseLabel(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim()
  if (!trimmed || trimmed === 'unknown') return 'sin identificar'
  if (/^[0-9a-f]{40}$/i.test(trimmed)) return trimmed.slice(0, 7)
  return trimmed.length > 12 ? trimmed.slice(0, 12) : trimmed
}

export default function CristianEnvironmentBanner() {
  if (process.env.APP_DEPLOYMENT_ENV !== 'cristian-pruebas') return null
  const build = formatReleaseLabel(process.env.APP_RELEASE_SHA)
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 bg-amber-400 px-3 py-1 text-center text-xs font-semibold text-slate-950"
    >
      Entorno Cristian (pruebas) · build {build} · no es producción
    </div>
  )
}