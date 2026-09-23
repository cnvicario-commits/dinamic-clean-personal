'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

type Empleado = { id: string; nombre_apellido: string }
type Cliente = { id: string; nombre: string }
type Asignacion = { empleado_id: string; cliente_id: string }
type Codigo = { codigo: string; descripcion: string }

function fechaHoy() {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export default function AusenciaForm({
  empleados,
  clientes,
  asignaciones,
  codigos,
}: {
  empleados: Empleado[]
  clientes: Cliente[]
  asignaciones: Asignacion[]
  codigos: Codigo[]
}) {
  const [clienteId, setClienteId] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [mostrarListaCliente, setMostrarListaCliente] = useState(false)

  const [empleadoId, setEmpleadoId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarLista, setMostrarLista] = useState(false)

  const [fecha, setFecha] = useState(fechaHoy())
  const [codigo, setCodigo] = useState('P')
  const [horasExtras, setHorasExtras] = useState('0')
  const [observaciones, setObservaciones] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [clienteDestinoId, setClienteDestinoId] = useState('')
  const [clienteHorasExtraId, setClienteHorasExtraId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const contenedorClienteRef = useRef<HTMLDivElement>(null)
  const contenedorEmpleadoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (contenedorClienteRef.current && !contenedorClienteRef.current.contains(e.target as Node)) {
        setMostrarListaCliente(false)
      }
      if (contenedorEmpleadoRef.current && !contenedorEmpleadoRef.current.contains(e.target as Node)) {
        setMostrarLista(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  const clientesFiltrados = busquedaCliente.trim() === ''
    ? clientes
    : clientes.filter((c) => c.nombre.toLowerCase().includes(busquedaCliente.toLowerCase()))

  // Si hay cliente elegido, solo se muestran sus empleados asignados. Si no, se muestran todos.
  const empleadosBase = clienteId
    ? empleados.filter((emp) =>
        asignaciones.some((a) => a.cliente_id === clienteId && a.empleado_id === emp.id)
      )
    : empleados

  const empleadosFiltrados = busqueda.trim() === ''
    ? empleadosBase
    : empleadosBase.filter((emp) => emp.nombre_apellido.toLowerCase().includes(busqueda.toLowerCase()))

  // Asignaciones activas del empleado elegido: si tiene 2 o más, el cliente "habitual"
  // es ambiguo y hay que pedir que se elija explícitamente en los campos de destino.
  const asignacionesEmpleado = asignaciones.filter((a) => a.empleado_id === empleadoId)
  const habitualAmbiguo = asignacionesEmpleado.length >= 2
  const trabajoElDia = codigo === 'P'
  const tieneHorasExtra = (parseFloat(horasExtras) || 0) > 0

  function seleccionarCliente(c: Cliente) {
    setClienteId(c.id)
    setBusquedaCliente(c.nombre)
    setMostrarListaCliente(false)
    // Si el empleado elegido no pertenece a este cliente, se limpia
    if (empleadoId && !asignaciones.some((a) => a.cliente_id === c.id && a.empleado_id === empleadoId)) {
      setEmpleadoId('')
      setBusqueda('')
    }
  }

  function limpiarCliente() {
    setClienteId('')
    setBusquedaCliente('')
  }

  function seleccionarEmpleado(emp: Empleado) {
    setEmpleadoId(emp.id)
    setBusqueda(emp.nombre_apellido)
    setMostrarLista(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!empleadoId) {
      setError('Elegí un empleado de la lista antes de guardar.')
      return
    }

    if (trabajoElDia && habitualAmbiguo && !clienteDestinoId) {
      setError('Este empleado tiene más de un cliente activo: elegí en qué cliente trabajó este día.')
      return
    }

    if (tieneHorasExtra && habitualAmbiguo && !clienteHorasExtraId) {
      setError('Este empleado tiene más de un cliente activo: elegí en qué cliente hizo las horas extra.')
      return
    }

    setLoading(true)
    let archivoUrl: string | null = null
    if (archivo) {
      const nombreArchivo = `${empleadoId}_${Date.now()}_${archivo.name}`
      const { error: uploadError } = await supabase.storage
        .from('justificaciones')
        .upload(nombreArchivo, archivo)
      if (uploadError) {
        setError('Error al subir archivo: ' + uploadError.message)
        setLoading(false)
        return
      }
      const { data: signedData } = await supabase.storage
        .from('justificaciones')
        .createSignedUrl(nombreArchivo, 60 * 60 * 24 * 365)
      archivoUrl = signedData?.signedUrl || null
    }
    const { error: insertError } = await (async () => { try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.upsertAttendance({
        empleadoId, fecha, codigo, horasExtras: parseFloat(horasExtras) || 0,
        observaciones, archivoUrl, clienteDestinoId: trabajoElDia ? (clienteDestinoId || null) : null,
        clienteHorasExtraId: tieneHorasExtra ? (clienteHorasExtraId || null) : null,
      }); return { error:null as {message:string}|null }
    } catch (e) { return { error: { message: e instanceof Error ? e.message : 'Error al guardar' } } } })()
    setLoading(false)
    if (insertError) {
      setError('Error al guardar: ' + insertError.message)
      return
    }
    setEmpleadoId('')
    setBusqueda('')
    setFecha(fechaHoy())
    setCodigo('P')
    setHorasExtras('0')
    setObservaciones('')
    setArchivo(null)
    setClienteDestinoId('')
    setClienteHorasExtraId('')
    router.refresh()
  }

  const inputStyle = "px-3 py-3 border border-slate-300 rounded-lg text-base text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Buscador de cliente (opcional) */}
      <div ref={contenedorClienteRef} className="relative">
        <label className="text-sm text-slate-700 block mb-1">Cliente (opcional, para filtrar empleados)</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Escribí el nombre del cliente..."
            value={busquedaCliente}
            onChange={(e) => {
              setBusquedaCliente(e.target.value)
              setClienteId('')
              setMostrarListaCliente(true)
            }}
            onFocus={() => setMostrarListaCliente(true)}
            className={inputStyle}
            autoComplete="off"
          />
          {clienteId && (
            <button
              type="button"
              onClick={limpiarCliente}
              className="px-3 py-3 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Quitar
            </button>
          )}
        </div>
        {mostrarListaCliente && (
          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
            {clientesFiltrados.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-400">Sin resultados</p>
            ) : (
              clientesFiltrados.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => seleccionarCliente(c)}
                  className="w-full text-left px-3 py-3 text-sm text-slate-800 hover:bg-teal-50 active:bg-teal-100 border-b border-slate-100 last:border-0"
                >
                  {c.nombre}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Buscador de empleado */}
      <div ref={contenedorEmpleadoRef} className="relative">
        <label className="text-sm text-slate-700 block mb-1">Empleado</label>
        <input
          type="text"
          placeholder={clienteId ? "Escribí el nombre (empleados de este cliente)..." : "Escribí el nombre del empleado..."}
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setEmpleadoId('')
            setMostrarLista(true)
          }}
          onFocus={() => setMostrarLista(true)}
          className={inputStyle}
          autoComplete="off"
        />
        {mostrarLista && (
          <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
            {empleadosFiltrados.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-400">
                {clienteId ? 'Este cliente no tiene empleados asignados.' : 'Sin resultados'}
              </p>
            ) : (
              empleadosFiltrados.map((emp) => (
                <button
                  type="button"
                  key={emp.id}
                  onClick={() => seleccionarEmpleado(emp)}
                  className="w-full text-left px-3 py-3 text-sm text-slate-800 hover:bg-teal-50 active:bg-teal-100 border-b border-slate-100 last:border-0"
                >
                  {emp.nombre_apellido}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div>
        <label className="text-sm text-slate-700 block mb-1">Fecha</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inputStyle} />
      </div>

      <div>
        <label className="text-sm text-slate-700 block mb-1">Código del día</label>
        <select value={codigo} onChange={(e) => setCodigo(e.target.value)} className={inputStyle}>
          {codigos.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.codigo} — {c.descripcion}
            </option>
          ))}
        </select>
      </div>

      {trabajoElDia && (
        <div>
          <label className="text-sm text-slate-700 block mb-1">
            Cliente donde trabajó (si fue distinto al habitual){habitualAmbiguo && ' *'}
          </label>
          <select
            value={clienteDestinoId}
            onChange={(e) => setClienteDestinoId(e.target.value)}
            required={habitualAmbiguo}
            className={inputStyle}
          >
            <option value="">
              {habitualAmbiguo ? 'Elegí el cliente...' : 'El habitual (sin cambios)'}
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {habitualAmbiguo && (
            <p className="text-xs text-amber-600 mt-1">
              Este empleado tiene más de un cliente activo: elegí en cuál trabajó hoy.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="text-sm text-slate-700 block mb-1">Horas extra ese día (opcional)</label>
        <input
          type="number"
          min="0"
          step="0.5"
          value={horasExtras}
          onChange={(e) => setHorasExtras(e.target.value)}
          className={inputStyle}
        />
      </div>

      {tieneHorasExtra && (
        <div>
          <label className="text-sm text-slate-700 block mb-1">
            Cliente de las horas extra{habitualAmbiguo && ' *'}
          </label>
          <select
            value={clienteHorasExtraId}
            onChange={(e) => setClienteHorasExtraId(e.target.value)}
            required={habitualAmbiguo}
            className={inputStyle}
          >
            <option value="">
              {habitualAmbiguo ? 'Elegí el cliente...' : 'El habitual (sin cambios)'}
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {habitualAmbiguo && (
            <p className="text-xs text-amber-600 mt-1">
              Este empleado tiene más de un cliente activo: elegí en cuál hizo las horas extra.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="text-sm text-slate-700 block mb-1">Observaciones (opcional)</label>
        <textarea placeholder="Observaciones (opcional)" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={`${inputStyle} placeholder:text-slate-400`} />
      </div>

      <div>
        <label className="text-sm text-slate-700 block mb-1">Justificación (opcional, foto o PDF)</label>
        <input type="file" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="text-sm text-slate-700" />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white text-base font-medium rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto sm:self-start"
      >
        {loading ? 'Guardando...' : 'Registrar novedad'}
      </button>

      {error && <p className="text-rose-600 text-sm">{error}</p>}
    </form>
  )
}
