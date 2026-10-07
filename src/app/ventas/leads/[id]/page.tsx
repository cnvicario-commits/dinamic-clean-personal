import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import DatosLead from '@/components/DatosLead'
import RegistrarSeguimientoLeadForm from '@/components/RegistrarSeguimientoLeadForm'

function formatearFecha(fecha: string | null) {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

export default async function FichaLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const api = await createAuthenticatedServerApiClient()
  let lead
  try {
    lead = await api.getCrmLead(id)
  } catch {
    lead = null
  }
  if (!lead) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Lead no encontrado.</p>
        <Link href="/ventas/leads" className="text-teal-600 hover:underline text-sm">← Volver al tablero</Link>
      </div>
    )
  }
  const [seguimientos, catalogs, me] = await Promise.all([
    api.listCrmLeadFollowUps(id, { pageSize: 100 }),
    api.getCrmCatalogs(),
    api.getMe(),
  ])
  const items = seguimientos.items as unknown as Array<{
    id: string
    tipo_contacto: string | null
    fecha_contacto: string | null
    nota: string | null
    perfiles: { nombre_completo: string } | null
  }>

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/ventas/leads" className="text-teal-600 hover:underline text-sm mb-4 inline-block">← Volver al tablero</Link>
      <DatosLead
        lead={lead}
        tiposCliente={catalogs.tiposCliente}
        referidores={catalogs.referidores}
        puedeEliminar={me.permissions.includes('crm:delete')}
      />
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Seguimientos</h2>
      <div className="mb-4">
        <RegistrarSeguimientoLeadForm leadId={lead.id} />
      </div>
      <div className="space-y-2">
        {items.length === 0 ? <p className="text-sm text-slate-400">Sin seguimientos.</p> : items.map((item) => (
          <article key={item.id} className="bg-white border border-slate-200 rounded-lg p-3 text-sm">
            <p className="text-slate-500">{formatearFecha(item.fecha_contacto)} · {item.tipo_contacto ?? 'Nota'} · {item.perfiles?.nombre_completo ?? '-'}</p>
            <p className="text-slate-800 mt-1">{item.nota ?? '-'}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
