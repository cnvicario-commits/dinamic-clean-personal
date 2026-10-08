import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import ArticulosPanel from '@/components/ArticulosPanel'
import ImportarArticulos from '@/components/ImportarArticulos'
import ExportarCatalogoArticulos from '@/components/ExportarCatalogoArticulos'

export default async function ArticulosPage() {
  const api=await createAuthenticatedServerApiClient()
  const [articulos,proveedoresTodos]=await Promise.all([api.listArticles(),api.listSuppliers()])
  const proveedores=proveedoresTodos.filter(p=>p.activo)

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Artículos</h1>
        <ExportarCatalogoArticulos articulos={articulos} />
      </div>
      <ImportarArticulos />
      <ArticulosPanel articulos={articulos} proveedores={proveedores} />
    </div>
  )
}
