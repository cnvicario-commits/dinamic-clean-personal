import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import Link from 'next/link'
import OrdenCompraForm from '@/components/OrdenCompraForm'

export default async function NuevaOrdenCompraPage() {
  const {empresas,proveedores,clientes,articulos,preciosProveedor,domicilios}=await(await createAuthenticatedServerApiClient()).getPurchaseCatalogs()

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/ordenes-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a órdenes de compra
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nueva orden de compra</h1>
      <OrdenCompraForm
        empresas={empresas} proveedores={proveedores} clientes={clientes} articulos={articulos} preciosProveedor={preciosProveedor} domicilios={domicilios}
      />
    </div>
  )
}
