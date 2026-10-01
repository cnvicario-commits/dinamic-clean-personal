import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import OportunidadForm from '@/components/OportunidadForm'

export default async function NuevaOportunidadPage({
  searchParams,
}: {
  // Cuando se viene de "Convertir a oportunidad" en la ficha de un lead (ver
  // DatosLead.tsx): precarga el prospecto y, al guardar, marca ese lead como
  // convertido enlazándolo con la oportunidad nueva.
  searchParams: Promise<{ leadId?: string; prospectoId?: string }>
}) {
  const { leadId, prospectoId } = await searchParams
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Solo admin puede asignarle la oportunidad a cualquier perfil del
  // sistema: el resto (gerente, ventas) la crea siempre a su propio nombre,
  // porque con la RLS de crm_oportunidades (ver migración 0035) solo va a
  // poder ver/editar después lo que le quede asignado a sí mismo.
  const { data: miPerfil } = session
    ? await supabase.from('perfiles').select('nombre_completo, rol').eq('id', session.user.id).single()
    : { data: null }
  const esAdmin = miPerfil?.rol === 'admin'

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
    esAdmin
      ? supabase.from('perfiles').select('id, nombre_completo').order('nombre_completo')
      : Promise.resolve({ data: [] as { id: string; nombre_completo: string }[] }),
  ])

  const responsableFijo =
    !esAdmin && session && miPerfil ? { id: session.user.id, nombre_completo: miPerfil.nombre_completo } : null

  const { data: prospectoInicial } = prospectoId
    ? await supabase.from('crm_prospectos').select('id, nombre').eq('id', prospectoId).single()
    : { data: null }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href={leadId ? `/ventas/leads/${leadId}` : '/ventas'} className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver {leadId ? 'al lead' : 'al tablero'}
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nueva oportunidad</h1>
      {leadId && (
        <p className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 mb-4">
          Se va a crear a partir de un lead. Al guardar, ese lead queda marcado como convertido.
        </p>
      )}
      <OportunidadForm
        prospectos={prospectos ?? []}
        tiposServicio={tiposServicio ?? []}
        tiposCliente={tiposCliente ?? []}
        referidores={referidores ?? []}
        responsables={responsables ?? []}
        responsableFijo={responsableFijo}
        prospectoInicial={prospectoInicial ?? null}
        leadId={leadId ?? null}
      />
    </div>
  )
}
