'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Empleado = { id: string; nombre_apellido: string }
type Cliente = { id: string; nombre: string }
type Asignacion = { empleado_id: string; cliente_id: string }

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
}: {
  empleados: Empleado[]
  clientes: Cliente[]
  asignaciones: Asignacion[]
}) {
  const [clienteId, setClienteId] = useState('')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [mostrarListaCliente, setMostrarListaCliente] = useState(false)

  const [empleadoId, setEmpleadoId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarLista, setMostrarLista] = useState(false)

  const [fecha, setFecha] = useState(fechaHoy())
  const [justificada, setJustificada] = useState('true')
  const [observaciones, setObservaciones] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
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
    const { data: userData } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('ausencias').insert({
      empleado_id: empleadoId,
      fecha: fecha,
      justificada: justificada === 'true',
      observaciones: observaciones,
      archivo_url: archivoUrl,
      informado_por: userData.user?.id,
    })
    setLoading(false)
    if (insertError) {
      setError('Error al guardar: ' + insertError.message)
      return
    }
    setEmpleadoId('')
    setBusqueda('')
    setFecha(fechaHoy())
    setJustificada('true')
    setObservaciones('')
    setArchivo(null)
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
        <label className="text-sm text-slate-700 block mb-1">Estado</label>
        <select value={justificada} onChange={(e) => setJustificada(e.target.value)} className={inputStyle}>
          <option value="true">Justificada</option>
          <option value="false">Injustificada</option>
        </select>
      </div>

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
        {loading ? 'Guardando...' : 'Registrar ausencia'}
      </button>

      {error && <p className="text-rose-600 text-sm">{error}</p>}
    </form>
  )
}