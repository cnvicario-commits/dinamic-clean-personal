import type { ComponentProps } from 'react'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import Link from 'next/link'
import OrdenesCompraTabla from '@/components/OrdenesCompraTabla'

export default async function OrdenesCompraPage() {
  const api=await createAuthenticatedServerApiClient();const [ordenes,catalogs]=await Promise.all([api.listPurchaseOrders(),api.getPurchaseCatalogs()])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Órdenes de compra</h1>
        <Link
          href="/ordenes-compra/nuevo"
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Nueva orden de compra
        </Link>
      </div>
      <OrdenesCompraTabla
        ordenes={ordenes as ComponentProps<typeof OrdenesCompraTabla>['ordenes']}
        clientes={catalogs.clientes} empresas={catalogs.empresas} proveedores={catalogs.proveedores}
      />
    </div>
  )
}
