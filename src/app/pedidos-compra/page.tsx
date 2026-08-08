import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import PedidosCompraTabla from '@/components/PedidosCompraTabla'

export default async function PedidosCompraPage() {
  const supabase = await createClient()
  const [{ data: pedidos }, { data: clientes }, { data: empresas }] = await Promise.all([
    supabase
      .from('pedidos_compra')
      .select('*, empresas(nombre), clientes(nombre)')
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('empresas').select('*').order('nombre'),
  ])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pedidos de compra</h1>
        <Link
          href="/pedidos-compra/nuevo"
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Nuevo pedido
        </Link>
      </div>

      <PedidosCompraTabla
        pedidos={(pedidos ?? []) as any}
        clientes={clientes ?? []}
        empresas={empresas ?? []}
      />
    </div>
  )
}
