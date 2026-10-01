import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import LeadForm from '@/components/LeadForm'

export default async function NuevoLeadPage() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Mismo criterio que /ventas/nueva: solo admin puede asignarle el lead a
  // cualquier perfil, el resto lo crea siempre a su propio nombre (ver RLS
  // de crm_leads en la migración 0036).
  const { data: miPerfil } = session
    ? await supabase.from('perfiles').select('nombre_completo, rol').eq('id', session.user.id).single()
    : { data: null }
  const esAdmin = miPerfil?.rol === 'admin'

  const [{ data: prospectos }, { data: tiposCliente }, { data: referidores }, { data: responsables }] = await Promise.all([
    supabase.from('crm_prospectos').select('id, nombre').order('nombre'),
    supabase.from('crm_tipos_cliente').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('crm_referidores').select('id, nombre').eq('activo', true).order('nombre'),
    esAdmin
      ? supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo')
      : Promise.resolve({ data: [] as { id: string; nombre_completo: string }[] }),
  ])

  const responsableFijo =
    !esAdmin && session && miPerfil ? { id: session.user.id, nombre_completo: miPerfil.nombre_completo } : null

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/ventas/leads" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a Leads
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nuevo lead</h1>
      <LeadForm
        prospectos={prospectos ?? []}
        tiposCliente={tiposCliente ?? []}
        referidores={referidores ?? []}
        responsables={responsables ?? []}
        responsableFijo={responsableFijo}
      />
    </div>
  )
}
