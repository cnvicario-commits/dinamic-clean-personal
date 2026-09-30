import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import OportunidadForm from '@/components/OportunidadForm'

export default async function NuevaOportunidadPage() {
  const api = await createAuthenticatedServerApiClient()
  const catalogs = await api.getCrmCatalogs()

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/ventas" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver al tablero
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nueva oportunidad</h1>
      <OportunidadForm
        prospectos={catalogs.prospectos}
        tiposServicio={catalogs.tiposServicio}
        tiposCliente={catalogs.tiposCliente}
        referidores={catalogs.referidores}
        responsables={catalogs.responsables}
      />
    </div>
  )
}
