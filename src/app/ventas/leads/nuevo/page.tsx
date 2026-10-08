import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import LeadForm from '@/components/LeadForm'

export default async function NuevoLeadPage() {
  const api = await createAuthenticatedServerApiClient()
  const [catalogs, me] = await Promise.all([api.getCrmCatalogs(), api.getMe()])
  const responsableFijo =
    me.role === 'ventas'
      ? { id: me.userId, nombre_completo: me.nombreCompleto ?? 'Mi usuario' }
      : null

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/ventas/leads" className="text-teal-600 hover:underline text-sm mb-4 inline-block">← Volver al tablero</Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nuevo lead</h1>
      <LeadForm
        prospectos={catalogs.prospectos}
        tiposCliente={catalogs.tiposCliente}
        referidores={catalogs.referidores}
        responsables={catalogs.responsables}
        responsableFijo={responsableFijo}
      />
    </div>
  )
}
