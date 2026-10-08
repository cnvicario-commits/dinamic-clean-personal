import type { ComponentProps } from 'react'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import Link from 'next/link'
import PedidosCompraTabla from '@/components/PedidosCompraTabla'

export default async function PedidosCompraPage() {
  const api = await createAuthenticatedServerApiClient()
  const [pedidos,catalogs] = await Promise.all([api.listPurchaseRequests(),api.getPurchaseCatalogs()])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pedidos de compra</h1>
        <div className="flex gap-2">
          <Link
            href="/pedidos-compra/importar"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Importar desde Excel (varios clientes)
          </Link>
          <Link
            href="/pedidos-compra/nuevo"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Nuevo pedido
          </Link>
        </div>
      </div>

      <PedidosCompraTabla
        pedidos={pedidos as ComponentProps<typeof PedidosCompraTabla>['pedidos']}
        clientes={catalogs.clientes}
        empresas={catalogs.empresas}
      />
    </div>
  )
}
