import { createClient } from '@/utils/supabase/server'
import PedidosDepositoTabla from '@/components/PedidosDepositoTabla'

export default async function PedidosDepositoPage() {
  const supabase = await createClient()
  const [{ data: pedidos }, { data: clientes }, { data: empresas }] = await Promise.all([
    supabase
      .from('pedidos_deposito')
      .select('*, empresas(nombre), clientes(nombre)')
      .order('fecha', { ascending: false }),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('empresas').select('*').order('nombre'),
  ])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Pedidos a depósito</h1>
      <PedidosDepositoTabla
        pedidos={(pedidos ?? []) as any}
        clientes={clientes ?? []}
        empresas={empresas ?? []}
      />
    </div>
  )
}
