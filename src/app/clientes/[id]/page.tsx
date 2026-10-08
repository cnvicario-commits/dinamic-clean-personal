import { createClient } from '@/utils/supabase/server'
import { createDinamicApiClient } from '@/lib/api/generated'
import Link from 'next/link'
import ClienteDomiciliosPanel from '@/components/ClienteDomiciliosPanel'
import ClientePresupuestosPanel, { type ClientePresupuesto } from '@/components/ClientePresupuestosPanel'

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {data:{session}}=await supabase.auth.getSession()
  const baseUrl=process.env.API_URL??process.env.NEXT_PUBLIC_API_URL
  const detail=session?.access_token&&baseUrl?await createDinamicApiClient({baseUrl,accessToken:session.access_token}).getClient(id).catch(()=>null):null
  const cliente=detail?.client

  if (!cliente) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Cliente no encontrado.</p>
        <Link href="/clientes" className="text-teal-600 hover:underline text-sm">
          ← Volver a clientes
        </Link>
      </div>
    )
  }

  const domicilios=detail.addresses
  const presupuestos=detail.quotes

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/clientes" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a clientes
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{cliente.nombre}</h1>
      <div className="text-sm text-slate-500 mb-6 space-y-0.5">
        {cliente.domicilio && <p>Domicilio principal (ficha del cliente): {cliente.domicilio}</p>}
        {cliente.cuit && <p>CUIT: {cliente.cuit}</p>}
        {cliente.persona_contacto && <p>Persona de contacto: {cliente.persona_contacto}</p>}
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Domicilios de entrega
      </h2>
      <ClienteDomiciliosPanel clienteId={cliente.id} domicilios={domicilios ?? []} />

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 mt-8">
        Presupuestos enviados
      </h2>
      <ClientePresupuestosPanel
        clienteId={cliente.id}
        presupuestos={presupuestos as ClientePresupuesto[]}
      />
    </div>
  )
}
