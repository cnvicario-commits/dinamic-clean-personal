import { createClient } from '@/utils/supabase/server'
import ProveedoresPanel from '@/components/ProveedoresPanel'
import Link from 'next/link'

export default async function ProveedoresPage() {
  const supabase = await createClient()
  const { data: proveedores } = await supabase
    .from('proveedores')
    .select('*')
    .order('razon_social')

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Proveedores</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/proveedores/lista-precios" className="text-teal-600 hover:underline">
            Cargar lista de precios
          </Link>
          <Link href="/proveedores/pendientes" className="text-teal-600 hover:underline">
            Pendientes
          </Link>
        </div>
      </div>

      <ProveedoresPanel proveedores={proveedores ?? []} />
    </div>
  )
}
