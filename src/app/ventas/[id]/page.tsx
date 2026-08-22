import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import EstadoOportunidadBadge from '@/components/EstadoOportunidadBadge'
import RegistrarSeguimientoForm from '@/components/RegistrarSeguimientoForm'
import { nombreResponsable, nombreUsuarioSeguimiento } from '@/types/crm'

function formatearFecha(fecha: string | null) {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

function formatearMonto(valor: number | null) {
  if (valor === null) return '-'
  return valor.toLocaleString('es-AR', { minimumFractionDigits: 2 })
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{etiqueta}</p>
      <p className="text-sm text-slate-800">{valor}</p>
    </div>
  )
}

export default async function FichaOportunidadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: oportunidad } = await supabase
    .from('crm_oportunidades')
    .select(
      '*, crm_prospectos(id, nombre, contacto_nombre, telefono, email, crm_tipos_cliente(nombre), crm_referidores(nombre)), crm_tipos_servicio(nombre), perfiles(nombre_completo)'
    )
    .eq('id', id)
    .single()

  if (!oportunidad) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="text-slate-500 mb-4">Oportunidad no encontrada.</p>
        <Link href="/ventas" className="text-teal-600 hover:underline text-sm">
          ← Volver al tablero
        </Link>
      </div>
    )
  }

  // Más reciente primero: sirve como feed de actividad de la oportunidad.
  const { data: seguimientos } = await supabase
    .from('crm_seguimientos')
    .select('*, perfiles(nombre_completo)')
    .eq('oportunidad_id', id)
    .order('fecha_contacto', { ascending: false })
    .order('created_at', { ascending: false })

  const prospecto = oportunidad.crm_prospectos

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/ventas" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver al tablero
      </Link>

      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-slate-900">{prospecto?.nombre ?? '-'}</h1>
        <EstadoOportunidadBadge estado={oportunidad.estado} />
      </div>
      <div className="mb-6">
        {oportunidad.numero_referencia && (
          <p className="text-sm text-slate-500">Ref: {oportunidad.numero_referencia}</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6">
        <Campo etiqueta="Tipo de cliente" valor={prospecto?.crm_tipos_cliente?.nombre ?? '-'} />
        <Campo etiqueta="Contacto" valor={prospecto?.contacto_nombre ?? '-'} />
        <Campo etiqueta="Teléfono" valor={prospecto?.telefono ?? '-'} />
        <Campo etiqueta="Email" valor={prospecto?.email ?? '-'} />
        <Campo etiqueta="Referido por" valor={prospecto?.crm_referidores?.nombre ?? '-'} />
        <Campo etiqueta="Tipo de servicio" valor={oportunidad.crm_tipos_servicio?.nombre ?? '-'} />
        <Campo etiqueta="Cantidad de personal" valor={oportunidad.cantidad_personal?.toString() ?? '-'} />
        <Campo etiqueta="Monto estimado" valor={`$ ${formatearMonto(oportunidad.monto_estimado)}`} />
        <Campo
          etiqueta="Comisión"
          valor={
            oportunidad.comision_monto
              ? `$ ${formatearMonto(oportunidad.comision_monto)} (${oportunidad.comision_liquidada ? 'liquidada' : 'pendiente'})`
              : '-'
          }
        />
        <Campo etiqueta="Fecha de ingreso" valor={formatearFecha(oportunidad.fecha_ingreso)} />
        <Campo etiqueta="Fecha de envío" valor={formatearFecha(oportunidad.fecha_envio)} />
        <Campo etiqueta="Fecha de cierre" valor={formatearFecha(oportunidad.fecha_cierre)} />
        <Campo etiqueta="Próximo seguimiento" valor={formatearFecha(oportunidad.proxima_fecha_seguimiento)} />
        <Campo etiqueta="Responsable" valor={nombreResponsable(oportunidad)} />
      </div>

      {oportunidad.comentarios && (
        <p className="text-sm text-slate-600 mb-6">Comentarios: {oportunidad.comentarios}</p>
      )}

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Historial de seguimientos ({seguimientos?.length ?? 0})
      </h2>

      <div className="mb-4">
        <RegistrarSeguimientoForm oportunidadId={oportunidad.id} />
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
              {s.proxima_fecha_seguimiento && (
                <p className="text-xs text-teal-700 mt-1">
                  Próximo seguimiento: {formatearFecha(s.proxima_fecha_seguimiento)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
