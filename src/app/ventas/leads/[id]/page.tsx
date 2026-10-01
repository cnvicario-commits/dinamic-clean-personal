import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import DatosLead from '@/components/DatosLead'
import RegistrarSeguimientoLeadForm from '@/components/RegistrarSeguimientoLeadForm'
import { nombreUsuarioSeguimiento } from '@/types/crm'

function formatearFecha(fecha: string | null) {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

export default async function FichaLeadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: lead } = await supabase
    .from('crm_leads')
    .select(
      '*, crm_prospectos(id, nombre, contacto_nombre, telefono, email, tipo_cliente_id, referido_por_id, crm_tipos_cliente(nombre), crm_referidores(nombre)), perfiles(nombre_completo)'
    )
    .eq('id', id)
    .single()

  if (!lead) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Lead no encontrado.</p>
        <Link href="/ventas/leads" className="text-teal-600 hover:underline text-sm">
          ← Volver a Leads
        </Link>
      </div>
    )
  }

  const { data: seguimientos } = await supabase
    .from('crm_seguimientos_leads')
    .select('*, perfiles(nombre_completo)')
    .eq('lead_id', id)
    .order('fecha_contacto', { ascending: false })
    .order('created_at', { ascending: false })

  const [{ data: tiposCliente }, { data: referidores }] = await Promise.all([
    supabase.from('crm_tipos_cliente').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('crm_referidores').select('id, nombre').eq('activo', true).order('nombre'),
  ])

  const prospecto = lead.crm_prospectos

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/ventas/leads" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver a Leads
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">{prospecto?.nombre ?? '-'}</h1>

      <DatosLead lead={lead} tiposCliente={tiposCliente ?? []} referidores={referidores ?? []} />

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Historial de seguimientos ({seguimientos?.length ?? 0})
      </h2>

      <div className="mb-4">
        <RegistrarSeguimientoLeadForm leadId={lead.id} />
      </div>

      {(seguimientos ?? []).length === 0 ? (
        <p className="text-slate-500 text-sm">Todavía no hay seguimientos registrados.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {(seguimientos ?? []).map((s) => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-sm font-medium text-slate-800">
                  {s.tipo_contacto ?? 'Contacto'} — {formatearFecha(s.fecha_contacto)}
                </p>
                <p className="text-xs text-slate-500">{nombreUsuarioSeguimiento(s)}</p>
              </div>
              {s.nota && <p className="text-sm text-slate-600">{s.nota}</p>}
              {s.proxima_fecha_contacto && (
                <p className="text-xs text-teal-700 mt-1">
                  Próximo contacto: {formatearFecha(s.proxima_fecha_contacto)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
