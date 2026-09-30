import Link from 'next/link'
import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import EstadoOportunidadBadge from '@/components/EstadoOportunidadBadge'
import RegistrarSeguimientoForm from '@/components/RegistrarSeguimientoForm'
import DatosOportunidad from '@/components/DatosOportunidad'
import MarcarOportunidadVista from '@/components/MarcarOportunidadVista'
import { nombreUsuarioSeguimiento, type EstadoOportunidad } from '@/types/crm'
import type { ComponentProps } from 'react'

function formatearFecha(fecha: string | null) {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

export default async function FichaOportunidadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const api = await createAuthenticatedServerApiClient()
  let oportunidad
  try {
    oportunidad = await api.getCrmOpportunity(id)
  } catch {
    oportunidad = null
  }

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
  const [seguimientos, catalogs] = await Promise.all([
    api.listCrmFollowUps(id, { pageSize: 100 }),
    api.getCrmCatalogs(),
  ])

  const oportunidadDetalle = oportunidad as unknown as ComponentProps<typeof DatosOportunidad>['oportunidad']
  const prospecto = oportunidadDetalle.crm_prospectos
  const itemsSeguimiento = seguimientos.items as unknown as Array<{
    id: string
    tipo_contacto: string | null
    fecha_contacto: string | null
    nota: string | null
    proxima_fecha_seguimiento: string | null
    usuario_nombre_libre: string | null
    perfiles: { nombre_completo: string } | null
  }>

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* No renderiza nada: solo deja constancia de que este usuario vio la
          ficha ahora, para que deje de aparecer como novedad. */}
      <MarcarOportunidadVista oportunidadId={oportunidadDetalle.id} />

      <Link href="/ventas" className="text-teal-600 hover:underline text-sm mb-4 inline-block">
        ← Volver al tablero
      </Link>

      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold text-slate-900">{prospecto?.nombre ?? '-'}</h1>
        <EstadoOportunidadBadge estado={oportunidadDetalle.estado as EstadoOportunidad} />
      </div>

      <DatosOportunidad
        oportunidad={oportunidadDetalle}
        tiposServicio={catalogs.tiposServicio}
        tiposCliente={catalogs.tiposCliente}
        referidores={catalogs.referidores}
      />

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Historial de seguimientos ({seguimientos.total})
      </h2>

      <div className="mb-4">
        <RegistrarSeguimientoForm oportunidadId={oportunidadDetalle.id} />
      </div>

      {itemsSeguimiento.length === 0 ? (
        <p className="text-slate-500 text-sm">Todavía no hay seguimientos registrados.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {itemsSeguimiento.map((s) => (
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
