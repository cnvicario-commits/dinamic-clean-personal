import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import ImportarPedidosCompraMatriz from '@/components/ImportarPedidosCompraMatriz'

export default async function ImportarPedidosCompraPage() {
  const supabase = await createClient()
  const [{ data: empresas }, { data: clientes }, { data: articulos }, { data: domicilios }] = await Promise.all([
    supabase.from('empresas').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('articulos').select('id, codigo_interno, nombre, unidad, categoria, proveedor_habitual_id').eq('activo', true).order('nombre'),
    supabase.from('cliente_domicilios').select('id, cliente_id, alias, direccion, es_principal, activo, horario_atencion').eq('activo', true).order('alias'),
  ])

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/pedidos-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a pedidos de compra
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Importar pedidos de compra (varios clientes)</h1>
      <ImportarPedidosCompraMatriz
        empresas={empresas ?? []}
        clientes={clientes ?? []}
        articulos={articulos ?? []}
        domicilios={domicilios ?? []}
      />
    </div>
  )
}
