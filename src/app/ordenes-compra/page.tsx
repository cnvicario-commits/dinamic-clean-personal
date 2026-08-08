import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import OrdenesCompraTabla from '@/components/OrdenesCompraTabla'

export default async function OrdenesCompraPage() {
  const supabase = await createClient()
  const [{ data: ordenes }, { data: clientes }, { data: empresas }, { data: proveedores }] = await Promise.all([
    supabase
      .from('ordenes_compra')
      .select('*, empresas(nombre), proveedores(razon_social), clientes(nombre)')
      .order('fecha', { ascending: false }),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('empresas').select('*').order('nombre'),
    supabase.from('proveedores').select('id, razon_social').order('razon_social'),
  ])

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
        ordenes={(ordenes ?? []) as any}
        clientes={clientes ?? []}
        empresas={empresas ?? []}
        proveedores={proveedores ?? []}
      />
    </div>
  )
}
