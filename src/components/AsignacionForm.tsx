'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiClientError } from '@/lib/api/generated'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

type Empleado = { id: string; nombre_apellido: string }
type Cliente = { id: string; nombre: string }

export default function AsignacionForm({
  empleados,
  clientes,
}: {
  empleados: Empleado[]
  clientes: Cliente[]
}) {
  const [empleadoId, setEmpleadoId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.createAssignment({ empleadoId, clienteId, fechaDesde })
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'No se pudo guardar la asignación.')
      setLoading(false)
      return
    }
    setLoading(false)

    setEmpleadoId('')
    setClienteId('')
    setFechaDesde('')
    router.refresh()
  }

  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} required className={`flex-1 min-w-[200px] ${inputStyle}`}>
        <option value="">Seleccionar empleado</option>
        {empleados.map((emp) => (
          <option key={emp.id} value={emp.id}>{emp.nombre_apellido}</option>
        ))}
      </select>

      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} required className={`flex-1 min-w-[200px] ${inputStyle}`}>
        <option value="">Seleccionar cliente</option>
        {clientes.map((cli) => (
          <option key={cli.id} value={cli.id}>{cli.nombre}</option>
        ))}
      </select>

      <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} required className={`w-44 ${inputStyle}`} />

      <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
        {loading ? 'Guardando...' : 'Asignar'}
      </button>

      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </form>
  )
}
