import { createClient } from '@/utils/supabase/server'
import ArticulosPanel from '@/components/ArticulosPanel'

export default async function ArticulosPage() {
  const supabase = await createClient()
  const { data: articulos } = await supabase
    .from('articulos')
    .select('*')
    .order('nombre')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Artículos</h1>
      <ArticulosPanel articulos={articulos ?? []} />
    </div>
  )
}
