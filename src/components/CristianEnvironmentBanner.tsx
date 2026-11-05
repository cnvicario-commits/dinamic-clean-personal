export default function CristianEnvironmentBanner() {
  if (process.env.APP_DEPLOYMENT_ENV !== 'cristian-pruebas') return null
  const release = process.env.APP_RELEASE_SHA || 'unknown'
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-amber-400 px-3 py-1 text-center text-xs font-semibold text-slate-950"
    >
      Entorno de pruebas de Cristian. No es producción. Release {release}
    </div>
  )
}
