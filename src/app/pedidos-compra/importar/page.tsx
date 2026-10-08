import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import Link from 'next/link'
import ImportarPedidosCompraMatriz from '@/components/ImportarPedidosCompraMatriz'

export default async function ImportarPedidosCompraPage() {
  const {empresas,clientes,articulos,domicilios}=await (await createAuthenticatedServerApiClient()).getPurchaseCatalogs()

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/pedidos-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a pedidos de compra
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Importar pedidos de compra (varios clientes)</h1>
      <ImportarPedidosCompraMatriz
        empresas={empresas} clientes={clientes} articulos={articulos} domicilios={domicilios}
      />
    </div>
  )
}
