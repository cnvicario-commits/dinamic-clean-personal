import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import OrdenCompraForm from '@/components/OrdenCompraForm'

export default async function NuevaOrdenCompraPage() {
  const supabase = await createClient()
  const [
    { data: empresas },
    { data: proveedores },
    { data: clientes },
    { data: articulos },
    { data: preciosProveedor },
    { data: domicilios },
  ] = await Promise.all([
    supabase.from('empresas').select('id, nombre, domicilio').eq('activo', true).order('nombre'),
    supabase.from('proveedores').select('id, razon_social, domicilio, provincia, condicion_pago_default').eq('activo', true).order('razon_social'),
    supabase.from('clientes').select('id, nombre').order('nombre'),
    supabase.from('articulos').select('id, codigo_interno, nombre, unidad, categoria, proveedor_habitual_id').eq('activo', true).order('nombre'),
    supabase.from('articulos_proveedor').select('articulo_id, proveedor_id, precio').eq('activo', true),
    supabase.from('cliente_domicilios').select('id, cliente_id, alias, direccion, es_principal, activo, horario_atencion').eq('activo', true).order('alias'),
  ])

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/ordenes-compra" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a órdenes de compra
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nueva orden de compra</h1>
      <OrdenCompraForm
        empresas={empresas ?? []}
        proveedores={proveedores ?? []}
        clientes={clientes ?? []}
        articulos={articulos ?? []}
        preciosProveedor={preciosProveedor ?? []}
        domicilios={domicilios ?? []}
      />
    </div>
  )
}
