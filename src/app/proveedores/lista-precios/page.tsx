import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import CargaListaPrecios from '@/components/CargaListaPrecios'
import Link from 'next/link'

export default async function ListaPreciosPage() {
  const proveedores=(await (await createAuthenticatedServerApiClient()).listSuppliers()).filter(p=>p.activo)

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/proveedores" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a proveedores
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Cargar lista de precios</h1>
      <CargaListaPrecios proveedores={proveedores} />
    </div>
  )
}
