import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import PedidoCompraForm from '@/components/PedidoCompraForm'

export default async function NuevoPedidoCompraPage() {
  const supabase = await createClient()
  const [{ data: empresas }, { data: clientes }, { data: articulos }] = await Promise.all([
    supabase.from('empresas').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('articulos').select('id, codigo_interno, nombre, unidad').eq('activo', true).order('nombre'),
  ])

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/pedidos-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a pedidos de compra
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nuevo pedido de compra</h1>
      <PedidoCompraForm
        empresas={empresas ?? []}
        clientes={clientes ?? []}
        articulos={articulos ?? []}
      />
    </div>
  )
}
