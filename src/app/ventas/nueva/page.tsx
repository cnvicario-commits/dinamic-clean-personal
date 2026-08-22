import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import OportunidadForm from '@/components/OportunidadForm'

export default async function NuevaOportunidadPage() {
  const supabase = await createClient()
  const [
    { data: prospectos },
    { data: tiposServicio },
    { data: tiposCliente },
    { data: referidores },
    { data: responsables },
  ] = await Promise.all([
    supabase.from('crm_prospectos').select('id, nombre').order('nombre'),
    supabase.from('crm_tipos_servicio').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('crm_tipos_cliente').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('crm_referidores').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo'),
  ])

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/ventas" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver al tablero
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nueva oportunidad</h1>
      <OportunidadForm
        prospectos={prospectos ?? []}
        tiposServicio={tiposServicio ?? []}
        tiposCliente={tiposCliente ?? []}
        referidores={referidores ?? []}
        responsables={responsables ?? []}
      />
    </div>
  )
}
