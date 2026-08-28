'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import SelectConCrear from './SelectConCrear'
import BotonWhatsApp from './BotonWhatsApp'
import { nombreResponsable, type CatalogoItem } from '@/types/crm'

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
  tiposCliente,
  referidores,
}: {
  oportunidad: {
    id: string
    numero_referencia: string | null
    tipo_servicio_id: string | null
    cantidad_personal: number | null
    monto_estimado: number | null
    comision_monto: number | null
    comision_liquidada: boolean
    estado: string
    fecha_envio: string | null
    fecha_ingreso: string
    fecha_cierre: string | null
    fecha_facturacion: string | null
    proxima_fecha_seguimiento: string | null
    comentarios: string | null
    crm_tipos_servicio: { nombre: string } | null
    crm_prospectos: {
      id: string
      nombre: string
      tipo_cliente_id: string | null
      contacto_nombre: string | null
      telefono: string | null
      email: string | null
      referido_por_id: string | null
      crm_tipos_cliente: { nombre: string } | null
      crm_referidores: { nombre: string } | null
    } | null
    perfiles: { nombre_completo: string } | null
    responsable_nombre_libre: string | null
  }
  tiposServicio: CatalogoItem[]
  tiposCliente: CatalogoItem[]
  referidores: CatalogoItem[]
}) {
  const prospecto = oportunidad.crm_prospectos

  const [editando, setEditando] = useState(false)
  const [numeroReferencia, setNumeroReferencia] = useState(oportunidad.numero_referencia ?? '')
  const [tipoServicioId, setTipoServicioId] = useState(oportunidad.tipo_servicio_id ?? '')
  const [tiposServicioState, setTiposServicioState] = useState(tiposServicio)
  const [cantidadPersonal, setCantidadPersonal] = useState(oportunidad.cantidad_personal?.toString() ?? '')
  const [montoEstimado, setMontoEstimado] = useState(oportunidad.monto_estimado?.toString() ?? '')
  const [fechaEnvio, setFechaEnvio] = useState(oportunidad.fecha_envio ?? '')
  const [fechaFacturacion, setFechaFacturacion] = useState(oportunidad.fecha_facturacion ?? '')
  const [comisionMonto, setComisionMonto] = useState(oportunidad.comision_monto?.toString() ?? '')
  const [comisionLiquidada, setComisionLiquidada] = useState(oportunidad.comision_liquidada)
  const [comentarios, setComentarios] = useState(oportunidad.comentarios ?? '')

  // Datos del prospecto (viven en crm_prospectos, no en crm_oportunidades):
  // es dinámico, la info de contacto puede cambiar con el tiempo.
  const [tipoClienteId, setTipoClienteId] = useState(prospecto?.tipo_cliente_id ?? '')
  const [tiposClienteState, setTiposClienteState] = useState(tiposCliente)
  const [contactoNombre, setContactoNombre] = useState(prospecto?.contacto_nombre ?? '')
  const [telefono, setTelefono] = useState(prospecto?.telefono ?? '')
  const [email, setEmail] = useState(prospecto?.email ?? '')
  const [referidoPorId, setReferidoPorId] = useState(prospecto?.referido_por_id ?? '')
  const [referidoresState, setReferidoresState] = useState(referidores)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  function cancelar() {
    // Descarta cualquier cambio sin guardar y vuelve a los valores actuales.
    setNumeroReferencia(oportunidad.numero_referencia ?? '')
    setTipoServicioId(oportunidad.tipo_servicio_id ?? '')
    setCantidadPersonal(oportunidad.cantidad_personal?.toString() ?? '')
    setMontoEstimado(oportunidad.monto_estimado?.toString() ?? '')
    setFechaEnvio(oportunidad.fecha_envio ?? '')
    setFechaFacturacion(oportunidad.fecha_facturacion ?? '')
    setComisionMonto(oportunidad.comision_monto?.toString() ?? '')
    setComisionLiquidada(oportunidad.comision_liquidada)
    setComentarios(oportunidad.comentarios ?? '')
    setTipoClienteId(prospecto?.tipo_cliente_id ?? '')
    setContactoNombre(prospecto?.contacto_nombre ?? '')
    setTelefono(prospecto?.telefono ?? '')
    setEmail(prospecto?.email ?? '')
    setReferidoPorId(prospecto?.referido_por_id ?? '')
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
        fecha_facturacion: oportunidad.estado === 'aceptado' ? fechaFacturacion || null : null,
        comision_monto: comisionMonto ? Number(comisionMonto) : null,
        comision_liquidada: comisionLiquidada,
        comentarios: comentarios.trim() || null,
      })
      .eq('id', oportunidad.id)
    if (errUpdate) {
      setLoading(false)
      setError('Error al guardar: ' + errUpdate.message)
      return
    }

    // Los datos de contacto viven en crm_prospectos, no en crm_oportunidades
    // — se actualizan aparte, sobre el prospecto de esta oportunidad.
    if (prospecto) {
      const { error: errProspecto } = await supabase
        .from('crm_prospectos')
        .update({
          tipo_cliente_id: tipoClienteId || null,
          contacto_nombre: contactoNombre.trim() || null,
          telefono: telefono.trim() || null,
          email: email.trim() || null,
          referido_por_id: referidoPorId || null,
        })
        .eq('id', prospecto.id)
      if (errProspecto) {
        setLoading(false)
        setError('Se guardó la oportunidad, pero falló el prospecto: ' + errProspecto.message)
        return
      }
    }

    setLoading(false)
    setEditando(false)
    router.refresh()
  }

  async function eliminar() {
    // Borra en cascada el historial de seguimientos y las marcas de "visto"
    // de esta oportunidad (ver migraciones 0018 y 0024) — es permanente, por
    // eso la confirmación explícita. No borra el prospecto: si tiene otras
    // oportunidades, esas quedan igual.
    if (
      !confirm(
        'Se va a eliminar esta oportunidad junto con todo su historial de seguimientos. No se puede deshacer. ¿Confirmás?'
      )
    ) {
      return
    }
    setError('')
    setEliminando(true)
    const { error: errDelete } = await supabase.from('crm_oportunidades').delete().eq('id', oportunidad.id)
    if (errDelete) {
      setEliminando(false)
      setError('Error al eliminar: ' + errDelete.message)
      return
    }
    router.push('/ventas')
  }

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
          <BotonWhatsApp telefono={prospecto?.telefono} />
          {!editando ? (
            <>
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="text-sm text-teal-600 hover:underline"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={eliminar}
                disabled={eliminando}
                className="text-sm text-rose-600 hover:underline disabled:opacity-50"
              >
                {eliminando ? 'Eliminando...' : 'Eliminar oportunidad'}
              </button>
            </>
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
        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Tipo de cliente</p>
            <SelectConCrear
              tabla="crm_tipos_cliente"
              items={tiposClienteState}
              value={tipoClienteId}
              onChange={(id, items) => {
                setTipoClienteId(id)
                setTiposClienteState(items)
              }}
              placeholder="Elegir tipo de cliente"
              className={inputStyle}
            />
          </div>
        ) : (
          <Campo etiqueta="Tipo de cliente" valor={prospecto?.crm_tipos_cliente?.nombre ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Contacto</p>
            <input type="text" value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Contacto" valor={prospecto?.contacto_nombre ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Teléfono</p>
            <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Teléfono" valor={prospecto?.telefono ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Email</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} />
          </div>
        ) : (
          <Campo etiqueta="Email" valor={prospecto?.email ?? '-'} />
        )}

        {editando ? (
          <div>
            <p className="text-xs text-slate-500 mb-1">Referido por</p>
            <SelectConCrear
              tabla="crm_referidores"
              items={referidoresState}
              value={referidoPorId}
              onChange={(id, items) => {
                setReferidoPorId(id)
                setReferidoresState(items)
              }}
              placeholder="Referido por (opcional)"
              className={inputStyle}
            />
          </div>
        ) : (
          <Campo etiqueta="Referido por" valor={prospecto?.crm_referidores?.nombre ?? '-'} />
        )}

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

        {oportunidad.estado === 'aceptado' &&
          (editando ? (
            <div>
              <p className="text-xs text-slate-500 mb-1">Fecha de facturación</p>
              <input type="date" value={fechaFacturacion} onChange={(e) => setFechaFacturacion(e.target.value)} className={inputStyle} />
            </div>
          ) : (
            <Campo etiqueta="Fecha de facturación" valor={formatearFecha(oportunidad.fecha_facturacion)} />
          ))}

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
