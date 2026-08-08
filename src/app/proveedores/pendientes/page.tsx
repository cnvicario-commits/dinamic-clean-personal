import { createClient } from '@/utils/supabase/server'
import PendientesTabla from '@/components/PendientesTabla'
import Link from 'next/link'

export default async function PendientesPage() {
  const supabase = await createClient()

  const { data: pendientes } = await supabase
    .from('articulos_proveedor_pendientes')
    .select('id, codigo_proveedor, nombre_proveedor, precio, archivo_origen, motivo, created_at, proveedores(id, razon_social)')
    .eq('resuelto', false)
    .order('created_at', { ascending: false })

  const { data: articulos } = await supabase
    .from('articulos')
    .select('id, codigo_interno, nombre')
    .order('nombre')

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link href="/proveedores" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a proveedores
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Pendientes por resolver</h1>
      <PendientesTabla pendientes={(pendientes ?? []) as any} articulos={articulos ?? []} />
    </div>
  )
}
