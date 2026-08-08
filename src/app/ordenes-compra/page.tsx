import { createClient } from '@/utils/supabase/server'
import OrdenesCompraTabla from '@/components/OrdenesCompraTabla'

export default async function OrdenesCompraPage() {
  const supabase = await createClient()
  const [{ data: ordenes }, { data: clientes }, { data: empresas }, { data: proveedores }] = await Promise.all([
    supabase
      .from('ordenes_compra')
      .select('*, empresas(nombre), proveedores(razon_social), clientes(nombre)')
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('empresas').select('*').order('nombre'),
    supabase.from('proveedores').select('id, razon_social').order('razon_social'),
  ])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Órdenes de compra</h1>
      <OrdenesCompraTabla
        ordenes={(ordenes ?? []) as any}
        clientes={clientes ?? []}
        empresas={empresas ?? []}
        proveedores={proveedores ?? []}
      />
    </div>
  )
}
