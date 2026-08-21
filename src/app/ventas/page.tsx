import Link from 'next/link'

export default function VentasPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <p className="text-teal-600 text-sm font-semibold uppercase tracking-wide mb-2">Ventas</p>
      <h1 className="text-2xl font-bold text-slate-900 mb-3">Módulo en construcción</h1>
      <p className="text-slate-500 mb-8">
        Estamos trabajando en el módulo de Ventas (seguimiento de cotizaciones y prospectos). Todavía no está
        disponible.
      </p>
      <Link href="/portal" className="text-teal-600 hover:underline text-sm">
        ← Volver al portal
      </Link>
    </div>
  )
}
