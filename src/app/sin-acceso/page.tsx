import Link from 'next/link'

export default function SinAccesoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">No tenés permiso para ver esta sección</h1>
        <p className="text-sm text-slate-500 mb-6">Si te parece que deberías tener acceso, pedile a un administrador que revise tu usuario.</p>
        <Link href="/portal" className="text-teal-600 hover:underline text-sm">
          ← Volver al portal
        </Link>
      </div>
    </div>
  )
}
