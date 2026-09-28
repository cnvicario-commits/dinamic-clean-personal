import type { ComponentProps } from 'react'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import PendientesTabla from '@/components/PendientesTabla'
import Link from 'next/link'

export default async function PendientesPage() {
  const api=await createAuthenticatedServerApiClient()
  const [pendientes,articulos]=await Promise.all([api.listSupplierArticlePending(),api.listArticles()])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link href="/proveedores" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a proveedores
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Pendientes por resolver</h1>
      <PendientesTabla
        pendientes={pendientes as ComponentProps<typeof PendientesTabla>['pendientes']}
        articulos={articulos}
      />
    </div>
  )
}
