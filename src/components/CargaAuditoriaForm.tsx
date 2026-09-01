'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import BuscadorCliente from './BuscadorCliente'
import type { ChecklistItem, ResultadoRespuesta } from '@/types/auditoria'

type Cliente = { id: string; nombre: string }
type Domicilio = { id: string; cliente_id: string; alias: string; direccion: string | null; activo: boolean }
type Perfil = { id: string; nombre_completo: string }

type PlanificacionInfo = {
  id: string
  aliasId: string
  supervisorId: string
  clienteNombre: string
  sitioAlias: string
  sitioDireccion: string | null
  supervisorNombre: string
}

type RespuestaItem = { resultado: ResultadoRespuesta | ''; observaciones: string }

function hoyISO() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full'

const OPCIONES_RESULTADO: { valor: ResultadoRespuesta; etiqueta: string; color: string }[] = [
  { valor: 'conforme', etiqueta: 'Conforme', color: 'text-emerald-700' },
  { valor: 'no_conforme', etiqueta: 'No conforme', color: 'text-rose-700' },
  { valor: 'no_aplica', etiqueta: 'No aplica', color: 'text-slate-500' },
]

export default function CargaAuditoriaForm({
  plantillaId,
  items,
  clientes,
  domicilios,
  supervisores,
  planificacion,
}: {
  plantillaId: string
  items: ChecklistItem[]
  clientes: Cliente[]
  domicilios: Domicilio[]
  supervisores: Perfil[]
  planificacion: PlanificacionInfo | null
}) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [aliasId, setAliasId] = useState(planificacion?.aliasId ?? '')
  const [supervisorId, setSupervisorId] = useState(planificacion?.supervisorId ?? '')
  const [fechaRealizada, setFechaRealizada] = useState(hoyISO())
  const [evaluacionGeneral, setEvaluacionGeneral] = useState('')
  const [proximaSupervisionFecha, setProximaSupervisionFecha] = useState('')
  const [quejasComentariosCliente, setQuejasComentariosCliente] = useState('')
  const [otros, setOtros] = useState('')
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaItem>>(
    Object.fromEntries(items.map((it) => [it.id, { resultado: '', observaciones: '' }]))
  )
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardada, setGuardada] = useState<{ id: string; sitio: string; fecha: string } | null>(null)

  const supabase = createClient()

  const sitiosDelCliente = cliente ? domicilios.filter((d) => d.cliente_id === cliente.id && d.activo) : []

  function setResultado(itemId: string, resultado: ResultadoRespuesta) {
    setRespuestas((prev) => ({ ...prev, [itemId]: { ...prev[itemId], resultado } }))
  }

  function setObservaciones(itemId: string, observaciones: string) {
    setRespuestas((prev) => ({ ...prev, [itemId]: { ...prev[itemId], observaciones } }))
  }

  async function guardar() {
    setError('')
    if (!aliasId) {
      setError('Falta elegir el sitio a auditar.')
      return
    }
    if (!supervisorId) {
      setError('Falta el supervisor que hizo la auditoría.')
      return
    }
    if (!fechaRealizada) {
      setError('Falta la fecha en que se realizó la auditoría.')
      return
    }
    const sinResponder = items.filter((it) => !respuestas[it.id]?.resultado)
    if (sinResponder.length > 0) {
      setError(`Faltan ${sinResponder.length} ítem(s) sin responder (Conforme / No conforme / No aplica).`)
      return
    }
    const sinObservacion = items.filter(
      (it) => respuestas[it.id]?.resultado === 'no_conforme' && !respuestas[it.id]?.observaciones.trim()
    )
    if (sinObservacion.length > 0) {
      setError('Los ítems marcados "No conforme" necesitan una observación que explique qué se encontró.')
      return
    }

    setGuardando(true)

    const { data: nuevaAuditoria, error: errAuditoria } = await supabase
      .from('auditorias')
      .insert({
        planificacion_id: planificacion?.id ?? null,
        alias_id: aliasId,
        plantilla_id: plantillaId,
        fecha_realizada: fechaRealizada,
        supervisor_id: supervisorId,
        evaluacion_general: evaluacionGeneral.trim() || null,
        proxima_supervision_fecha: proximaSupervisionFecha || null,
        quejas_comentarios_cliente: quejasComentariosCliente.trim() || null,
        otros: otros.trim() || null,
      })
      .select('id')
      .single()
    if (errAuditoria || !nuevaAuditoria) {
      setError('Error al guardar la auditoría: ' + errAuditoria?.message)
      setGuardando(false)
      return
    }

    const filasRespuestas = items.map((it) => ({
      auditoria_id: nuevaAuditoria.id,
      item_id: it.id,
      resultado: respuestas[it.id].resultado,
      observaciones: respuestas[it.id].observaciones.trim() || null,
    }))
    const { error: errRespuestas } = await supabase.from('auditoria_respuestas').insert(filasRespuestas)
    if (errRespuestas) {
      // La cabecera de la auditoría ya quedó guardada aunque esto falle —
      // mismo criterio que el resto de la app (ej. ClienteForm con el
      // domicilio principal): se avisa, no se revierte lo ya guardado.
      setError('Se guardó la auditoría, pero fallaron las respuestas del checklist: ' + errRespuestas.message)
      setGuardando(false)
      return
    }

    if (planificacion) {
      await supabase.from('auditoria_planificaciones').update({ estado: 'realizada' }).eq('id', planificacion.id)
    }

    setGuardando(false)
    setGuardada({
      id: nuevaAuditoria.id,
      sitio: planificacion ? `${planificacion.clienteNombre} — ${planificacion.sitioAlias}` : (cliente?.nombre ?? '-') + (aliasId ? ` — ${sitiosDelCliente.find((d) => d.id === aliasId)?.alias ?? ''}` : ''),
      fecha: fechaRealizada,
    })
  }

  if (guardada) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
        <p className="text-emerald-800 font-medium mb-1">Auditoría guardada correctamente.</p>
        <p className="text-sm text-emerald-700 mb-4">
          {guardada.sitio} — {new Date(`${guardada.fecha}T00:00:00`).toLocaleDateString('es-AR')}
        </p>
        <div className="flex gap-4">
          <Link href={`/auditorias/${guardada.id}`} className="text-teal-600 hover:underline text-sm font-medium">
            Ver ficha de la auditoría
          </Link>
          <Link href="/auditorias/nueva" className="text-teal-600 hover:underline text-sm">
            Cargar otra auditoría
          </Link>
          <Link href="/auditorias/planificacion" className="text-teal-600 hover:underline text-sm">
            Volver a Planificación
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {planificacion ? (
          <>
            <div>
              <p className="text-xs text-slate-500 mb-1">Cliente</p>
              <p className="text-sm text-slate-800">{planificacion.clienteNombre}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Sitio</p>
              <p className="text-sm text-slate-800">
                {planificacion.sitioAlias}
                {planificacion.sitioDireccion ? ` — ${planificacion.sitioDireccion}` : ''}
              </p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-slate-500 mb-1">Cliente</p>
              <BuscadorCliente
                clientes={clientes}
                onSeleccionar={(c) => {
                  setCliente(c.id ? c : null)
                  setAliasId('')
                }}
              />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Sitio auditado</p>
              {!cliente ? (
                <p className="text-sm text-slate-400">Elegí primero el cliente.</p>
              ) : sitiosDelCliente.length === 0 ? (
                <p className="text-sm text-slate-500">Este cliente no tiene sitios activos cargados.</p>
              ) : (
                <select value={aliasId} onChange={(e) => setAliasId(e.target.value)} className={inputStyle}>
                  <option value="">Elegir sitio...</option>
                  {sitiosDelCliente.map((d) => (
                    <option key={d.id} value={d.id}>{d.direccion ? `${d.alias} — ${d.direccion}` : d.alias}</option>
                  ))}
                </select>
              )}
            </div>
          </>
        )}

        <div>
          <p className="text-xs text-slate-500 mb-1">Fecha de la auditoría</p>
          <input type="date" value={fechaRealizada} onChange={(e) => setFechaRealizada(e.target.value)} className={inputStyle} />
        </div>

        <div>
          <p className="text-xs text-slate-500 mb-1">Supervisor que auditó</p>
          <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={inputStyle}>
            <option value="">Elegir supervisor...</option>
            {supervisores.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre_completo}</option>
            ))}
          </select>
          {planificacion && !supervisorId && (
            <p className="text-xs text-slate-400 mt-1">Planificado para: {planificacion.supervisorNombre}</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Checklist ({items.length} ítems)
        </h2>
        <div className="flex flex-col gap-2">
          {items.map((it, i) => {
            const r = respuestas[it.id]
            return (
              <div key={it.id} className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-sm text-slate-800 mb-2">
                  <span className="text-slate-400 mr-1">{i + 1}.</span>
                  {it.texto}
                </p>
                <div className="flex flex-wrap gap-4 mb-2">
                  {OPCIONES_RESULTADO.map((op) => (
                    <label key={op.valor} className={`flex items-center gap-1.5 text-sm cursor-pointer ${r?.resultado === op.valor ? `font-medium ${op.color}` : 'text-slate-600'}`}>
                      <input
                        type="radio"
                        name={`resultado-${it.id}`}
                        checked={r?.resultado === op.valor}
                        onChange={() => setResultado(it.id, op.valor)}
                      />
                      {op.etiqueta}
                    </label>
                  ))}
                </div>
                {r?.resultado === 'no_conforme' && (
                  <input
                    type="text"
                    placeholder="Observación (obligatoria para No conforme)"
                    value={r.observaciones}
                    onChange={(e) => setObservaciones(it.id, e.target.value)}
                    className={inputStyle}
                  />
                )}
                {r?.resultado && r.resultado !== 'no_conforme' && (
                  <input
                    type="text"
                    placeholder="Observación (opcional)"
                    value={r.observaciones}
                    onChange={(e) => setObservaciones(it.id, e.target.value)}
                    className={inputStyle}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Otros datos</h2>
        <div>
          <p className="text-xs text-slate-500 mb-1">Evaluación general (opcional)</p>
          <input type="text" value={evaluacionGeneral} onChange={(e) => setEvaluacionGeneral(e.target.value)} className={inputStyle} />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Próxima supervisión propuesta (opcional)</p>
          <input type="date" value={proximaSupervisionFecha} onChange={(e) => setProximaSupervisionFecha(e.target.value)} className={`sm:w-56 ${inputStyle}`} />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Quejas / comentarios del cliente (opcional)</p>
          <textarea value={quejasComentariosCliente} onChange={(e) => setQuejasComentariosCliente(e.target.value)} rows={2} className={inputStyle} />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Otros (opcional)</p>
          <textarea value={otros} onChange={(e) => setOtros(e.target.value)} rows={2} className={inputStyle} />
        </div>
      </div>

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="self-start px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {guardando ? 'Guardando...' : 'Guardar auditoría'}
      </button>
    </div>
  )
}
