import type { ComponentProps } from 'react'
import { createClient } from '@/utils/supabase/server'
import PedidosDepositoTabla from '@/components/PedidosDepositoTabla'

export default async function PedidosDepositoPage() {
  const supabase = await createClient()
  const [{ data: pedidos }, { data: clientes }, { data: empresas }, { data: perfiles }] = await Promise.all([
    supabase
      .from('pedidos_deposito')
      .select('*, empresas(nombre), clientes(nombre)')
      .order('fecha', { ascending: false }),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('empresas').select('*').order('nombre'),
    // perfiles no tiene FK declarada hacia pedidos_deposito: se resuelve
    // nombre_completo armando este Map en vez de un join real de Supabase.
    supabase.from('perfiles').select('id, nombre_completo'),
  ])

  const nombrePorId = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo]))
  const pedidosConNombre = (pedidos ?? []).map((p) => ({
    ...p,
    creado_por_nombre: nombrePorId.get(p.creado_por) ?? null,
  }))

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Pedidos a depósito</h1>
      <PedidosDepositoTabla
        pedidos={pedidosConNombre as ComponentProps<typeof PedidosDepositoTabla>['pedidos']}
        clientes={clientes ?? []}
        empresas={empresas ?? []}
      />
    </div>
  )
}
