import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import OportunidadForm from '@/components/OportunidadForm'

export default async function NuevaOportunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; prospectoId?: string }>
}) {
  const { leadId, prospectoId } = await searchParams
  const api = await createAuthenticatedServerApiClient()
  const [catalogs, me] = await Promise.all([api.getCrmCatalogs(), api.getMe()])
  const responsableFijo =
    me.role === 'ventas'
      ? { id: me.userId, nombre_completo: me.nombreCompleto ?? 'Mi usuario' }
      : null
  const prospectoInicial = prospectoId
    ? catalogs.prospectos.find((prospecto) => prospecto.id === prospectoId) ?? null
    : null

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href={leadId ? `/ventas/leads/${leadId}` : '/ventas'} className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver {leadId ? 'al lead' : 'al tablero'}
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nueva oportunidad</h1>
      {leadId && (
        <p className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 mb-4">
          Se va a crear a partir de un lead. Al guardar, ese lead queda marcado como convertido.
        </p>
      )}
      <OportunidadForm
        prospectos={catalogs.prospectos}
        tiposServicio={catalogs.tiposServicio}
        tiposCliente={catalogs.tiposCliente}
        referidores={catalogs.referidores}
        responsables={catalogs.responsables}
        responsableFijo={responsableFijo}
        prospectoInicial={prospectoInicial}
        leadId={leadId ?? null}
      />
    </div>
  )
}
