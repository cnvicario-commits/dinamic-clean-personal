import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import ClienteDomiciliosPanel from '@/components/ClienteDomiciliosPanel'

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

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

  const { data: domicilios } = await supabase
    .from('cliente_domicilios')
    .select('*')
    .eq('cliente_id', id)
    .order('es_principal', { ascending: false })
    .order('alias')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/clientes" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a clientes
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">{cliente.nombre}</h1>
      {cliente.domicilio && (
        <p className="text-sm text-slate-500 mb-6">Domicilio principal (ficha del cliente): {cliente.domicilio}</p>
      )}

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Domicilios de entrega
      </h2>
      <ClienteDomiciliosPanel clienteId={cliente.id} domicilios={domicilios ?? []} />
    </div>
  )
}
