import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import PedidosEnviadosTabla from '@/components/PedidosEnviadosTabla'
import type { PedidoEnviado } from '@/types/compras'

export default async function PanelComprasPage() {
  const pedidosConEstado=(await (await createAuthenticatedServerApiClient()).listPurchaseRequests()).filter(p=>p.estado==='enviada') as unknown as PedidoEnviado[]

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Panel de compras</h1>
      <PedidosEnviadosTabla pedidos={pedidosConEstado} />
    </div>
  )
}
