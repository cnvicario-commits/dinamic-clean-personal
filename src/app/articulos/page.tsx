import { createClient } from '@/utils/supabase/server'
import ArticulosPanel from '@/components/ArticulosPanel'
import ImportarArticulos from '@/components/ImportarArticulos'
import ExportarCatalogoArticulos from '@/components/ExportarCatalogoArticulos'

export default async function ArticulosPage() {
  const supabase = await createClient()
  const { data: articulos } = await supabase
    .from('articulos')
    .select('*')
    .order('nombre')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Artículos</h1>
        <ExportarCatalogoArticulos articulos={articulos ?? []} />
      </div>
      <ImportarArticulos />
      <ArticulosPanel articulos={articulos ?? []} />
    </div>
  )
}
