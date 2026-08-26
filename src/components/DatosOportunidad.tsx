'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import SelectConCrear from './SelectConCrear'
import BotonWhatsApp from './BotonWhatsApp'
import { nombreResponsable, type CatalogoItem } from '@/types/crm'
import { mensajeSaludoWhatsapp } from '@/utils/whatsapp'

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

const inputStyle = 'w-full px-2 py-1 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

export default function DatosOportunidad({
  oportunidad,
  tiposServicio,
}: {
  oportunidad: {
    id: string
    numero_referencia: string | null
    tipo_servicio_id: string | null
    cantidad_personal: number | null
    monto_estimado: number | null
    comision_monto: number | null
    comision_liquidada: boolean
    fecha_envio: string | null
    fecha_ingreso: string
    fecha_cierre: string | null
    proxima_fecha_seguimiento: string | null
    comentarios: string | null
    crm_tipos_servicio: { nombre: string } | null
    crm_prospectos: {
      nombre: string
      crm_tipos_cliente: { nombre: string } | null
      contacto_nombre: string | null
      telefono: string | null
      email: string | null
      crm_referidores: { nombre: string } | null
    } | null
    perfiles: { nombre_completo: string } | null
    responsable_nombre_libre: string | null
  }
  tiposServicio: CatalogoItem[]
}) {
  const [editando, setEditando] = useState(false)
  const [numeroReferencia, setNumeroReferencia] = useState(oportunidad.numero_referencia ?? '')
  const [tipoServicioId, setTipoServicioId] = useState(oportunidad.tipo_servicio_id ?? '')
  const [tiposServicioState, setTiposServicioState] = useState(tiposServicio)
  const [cantidadPersonal, setCantidadPersonal] = useState(oportunidad.cantidad_personal?.toString() ?? '')
  const [montoEstimado, setMontoEstimado] = useState(oportunidad.monto_estimado?.toString() ?? '')
  const [fechaEnvio, setFechaEnvio] = useState(oportunidad.fecha_envio ?? '')
  const [comisionMonto, setComisionMonto] = useState(oportunidad.comision_monto?.toString() ?? '')
  const [comisionLiquidada, setComisionLiquidada] = useState(oportunidad.comision_liquidada)
  const [comentarios, setComentarios] = useState(oportunidad.comentarios ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  function cancelar() {
    // Descarta cualquier cambio sin guardar y vuelve a los valores actuales.
    setNumeroReferencia(oportunidad.numero_referencia ?? '')
    setTipoServicioId(oportunidad.tipo_servicio_id ?? '')
    setCantidadPersonal(oportunidad.cantidad_personal?.toString() ?? '')
    setMontoEstimado(oportunidad.monto_estimado?.toString() ?? '')
    setFechaEnvio(oportunidad.fecha_envio ?? '')
    setComisionMonto(oportunidad.comision_monto?.toString() ?? '')
    setComisionLiquidada(oportunidad.comision_liquidada)
    setComentarios(oportunidad.comentarios ?? '')
    setError('')
    setEditando(false)
  }

  async function guardar() {
    setError('')
    setLoading(true)
    const { error: errUpdate } = await supabase
      .from('crm_oportunidades')
      .update({
        numero_referencia: numeroReferencia.trim() || null,
        tipo_servicio_id: tipoServicioId || null,
        cantidad_personal: cantidadPersonal ? Number(cantidadPersonal) : null,
        monto_estimado: montoEstimado ? Number(montoEstimado) : null,
        fecha_envio: fechaEnvio || null,
        comision_monto: comisionMonto ? Number(comisionMonto) : null,
        comision_liquidada: comisionLiquidada,
        comentarios: comentarios.trim() || null,
      })
      .eq('id', oportunidad.id)
    setLoading(false)
    if (errUpdate) {
      setError('Error al guardar: ' + errUpdate.message)
      return
    }
    setEditando(false)
    router.refresh()
  }

  const prospecto = oportunidad.crm_prospectos

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        {editando ? (
          <input
            type="text"
            placeholder="N° de referencia (opcional)"
            value={numeroReferencia}
            onChange={(e) => setNumeroReferencia(e.target.value)}
            className={`w-48 ${inputStyle}`}
          />
        ) : (
          oportunidad.numero_referencia && <p className="text-sm text-slate-500">Ref: {oportunidad.numero_referencia}</p>
        )}
        <div className="flex items-center gap-3">
          <BotonWhatsApp
            telefono={prospecto?.telefono}
            mensaje={mensajeSaludoWhatsapp(prospecto?.contacto_nombre, prospecto?.nombre ?? '', oportunidad.crm_tipos_servicio?.nombre)}
          />
          {!editando ? (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-sm text-teal-600 hover:underline"
            >
              Editar
            </button>
          ) : (
            <div className="flex gap-3">
              <button type="button" onClick={cancelar} className="text-sm text-slate-500 hover:underline" disabled={loading}>
                Cancelar
              </button>
              <button type="button" onClick={guardar} className="text-sm text-teal-600 font-medium hover:underline" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-rose-600 text-sm mb-2">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        {/* Datos del prospecto: no se editan acá (viven en crm_prospectos). */}
        <Campo etiqueta="Tipo de cliente" valor={prospecto?.crm_tipos_cliente?.nombre ?? '-'} />
        <Campo etiqueta="Contacto" valor={prospecto?.contacto_nombre ?? '-'} />
        <Campo etiqueta="Teléfono" valor={prospecto?.telefono ?? '-'} />
        <Campo etiqueta="Email" valor={prospecto?.email ?? '-'} />
        <Campo etiqueta="Referido por" valor={prospecto?.crm_referidores?.nombre ?? '-'} />

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Tipo de servicio</p>
            <SelectConCrear
              tabla="crm_tipos_servicio"
              items={tiposServicioState}
              value={tipoServicioId}
              onChange={(id, items) => {
                setTipoServicioId(id)
                setTiposServicioState(items)
              }}
              placeholder="Elegir tipo de servicio"
              className={inputStyle}
            />
          </div>
        ) : (
          <Campo etiqueta="Tipo de servicio" valor={oportunidad.crm_tipos_servicio?.nombre ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Cantidad de personal</p>
            <input type="number" min="0" step="0.5" value={cantidadPersonal} onChange={(e) => setCantidadPersonal(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Cantidad de personal" valor={oportunidad.cantidad_personal?.toString() ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Monto estimado</p>
            <input type="number" min="0" step="any" value={montoEstimado} onChange={(e) => setMontoEstimado(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Monto estimado" valor={`$ ${formatearMonto(oportunidad.monto_estimado)}`} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Comisión</p>
            <input type="number" min="0" step="any" value={comisionMonto} onChange={(e) => setComisionMonto(e.target.value)} className={`mb-1 ${inputStyle}`} />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={comisionLiquidada} onChange={(e) => setComisionLiquidada(e.target.checked)} />
              Liquidada
            </label>
          </div>
        ) : (
          <Campo
            etiqueta="Comisión"
            valor={
              oportunidad.comision_monto
                ? `$ ${formatearMonto(oportunidad.comision_monto)} (${oportunidad.comision_liquidada ? 'liquidada' : 'pendiente'})`
                : '-'
            }
          />
        )}

        <Campo etiqueta="Fecha de ingreso" valor={formatearFecha(oportunidad.fecha_ingreso)} />

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Fecha de envío</p>
            <input type="date" value={fechaEnvio} onChange={(e) => setFechaEnvio(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Fecha de envío" valor={formatearFecha(oportunidad.fecha_envio)} />
        )}

        <Campo etiqueta="Fecha de cierre" valor={formatearFecha(oportunidad.fecha_cierre)} />
        <Campo etiqueta="Próximo seguimiento" valor={formatearFecha(oportunidad.proxima_fecha_seguimiento)} />
        <Campo etiqueta="Responsable" valor={nombreResponsable(oportunidad)} />
      </div>

      {editando ? (
        <textarea
          placeholder="Comentarios (opcional)"
          value={comentarios}
          onChange={(e) => setComentarios(e.target.value)}
          rows={3}
          className={`w-full mt-4 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500`}
        />
      ) : (
        oportunidad.comentarios && <p className="text-sm text-slate-600 mt-4">Comentarios: {oportunidad.comentarios}</p>
      )}
    </div>
  )
}
