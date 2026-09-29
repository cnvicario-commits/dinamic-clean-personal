import type { ComponentProps } from 'react'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import PedidosDepositoTabla from '@/components/PedidosDepositoTabla'

export default async function PedidosDepositoPage() {
  const api=await createAuthenticatedServerApiClient();const [pedidosConNombre,catalogs]=await Promise.all([api.listWarehouseRequests(),api.getPurchaseCatalogs()])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Pedidos a depósito</h1>
      <PedidosDepositoTabla
        pedidos={pedidosConNombre as ComponentProps<typeof PedidosDepositoTabla>['pedidos']}
        clientes={catalogs.clientes} empresas={catalogs.empresas}
      />
    </div>
  )
}
