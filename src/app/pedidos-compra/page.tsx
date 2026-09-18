import type { ComponentProps } from 'react'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import PedidosCompraTabla from '@/components/PedidosCompraTabla'

export default async function PedidosCompraPage() {
  const supabase = await createClient()
  const [{ data: pedidos }, { data: clientes }, { data: empresas }, { data: perfiles }] = await Promise.all([
    supabase
      .from('pedidos_compra')
      .select('*, empresas(nombre), clientes(nombre)')
      .order('created_at', { ascending: false }),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('empresas').select('*').order('nombre'),
    // perfiles no tiene FK declarada hacia pedidos_compra: se resuelve
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pedidos de compra</h1>
        <div className="flex gap-2">
          <Link
            href="/pedidos-compra/importar"
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Importar desde Excel (varios clientes)
          </Link>
          <Link
            href="/pedidos-compra/nuevo"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Nuevo pedido
          </Link>
        </div>
      </div>

      <PedidosCompraTabla
        pedidos={pedidosConNombre as ComponentProps<typeof PedidosCompraTabla>['pedidos']}
        clientes={clientes ?? []}
        empresas={empresas ?? []}
      />
    </div>
  )
}
