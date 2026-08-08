import { createClient } from '@/utils/supabase/server'
import PedidosEnviadosTabla from '@/components/PedidosEnviadosTabla'

export default async function PanelComprasPage() {
  const supabase = await createClient()
  const { data: pedidos } = await supabase
    .from('pedidos_compra')
    .select('*, empresas(nombre), clientes(nombre)')
    .eq('estado', 'enviada')
    .order('created_at', { ascending: true })

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Panel de compras</h1>
      <PedidosEnviadosTabla pedidos={(pedidos ?? []) as any} />
    </div>
  )
}
