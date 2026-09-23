'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

function formatoFecha(d: Date) {
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export default function ReporteHorasExtraCliente() {
  const hoy = new Date()
  const mesDefault = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const [mes, setMes] = useState(mesDefault)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerar = async () => {
    setError('')
    setLoading(true)
    try {
      const [anioSel, mesSel] = mes.split('-').map(Number)
      const desde = new Date(anioSel, mesSel - 2, 26)
      const hasta = new Date(anioSel, mesSel - 1, 25)
      const desdeStr = formatoFecha(desde)
      const hastaStr = formatoFecha(hasta)

      const api = await createAuthenticatedBrowserApiClient()
      const { attendance: asistencias, assignments: asignaciones, clients: clientes } = await api.getOvertimeReport(desdeStr, hastaStr)

      if (!asistencias || asistencias.length === 0) {
        setError('No hay horas extra cargadas en ese período.')
        setLoading(false)
        return
      }

      const clientesPorId = new Map(clientes.map((c) => [c.id, c]))
      const asignacionesPorEmpleado = new Map<string, string[]>()
      ;asignaciones.forEach((a) => {
        const lista = asignacionesPorEmpleado.get(a.empleado_id) || []
        lista.push(a.cliente_id)
        asignacionesPorEmpleado.set(a.empleado_id, lista)
      })

      // Cliente de cada fila: horas extra > destino del día > habitual (solo si no es ambiguo)
      function resolverClienteId(a: { empleado_id: string; cliente_destino_id: string | null; cliente_horas_extra_id: string | null }) {
        if (a.cliente_horas_extra_id) return a.cliente_horas_extra_id
        if (a.cliente_destino_id) return a.cliente_destino_id
        const activas = asignacionesPorEmpleado.get(a.empleado_id) || []
        return activas.length === 1 ? activas[0] : null
      }

      const SIN_DEFINIR = '__sin_definir__'

      const empleadosPorId = new Map<string, { nombre: string; porCliente: Map<string, number> }>()
      const clientesConHoras = new Map<string, string>()
      let hayHorasSinDefinir = false

      asistencias.forEach((a) => {
        const clienteId = resolverClienteId(a)
        const claveCliente = clienteId || SIN_DEFINIR
        const clienteNombre = clienteId ? clientesPorId.get(clienteId)?.nombre || 'Sin definir' : 'Sin definir'
        const empleadoNombre = a.nombre_apellido || 'Sin nombre'

        if (claveCliente === SIN_DEFINIR) {
          hayHorasSinDefinir = true
        } else {
          clientesConHoras.set(claveCliente, clienteNombre)
        }

        if (!empleadosPorId.has(a.empleado_id)) {
          empleadosPorId.set(a.empleado_id, { nombre: empleadoNombre, porCliente: new Map() })
        }
        const empleado = empleadosPorId.get(a.empleado_id)!
        empleado.porCliente.set(claveCliente, (empleado.porCliente.get(claveCliente) || 0) + a.horas_extras)
      })

      const columnasCliente = Array.from(clientesConHoras.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([clienteId, nombre]) => ({ clave: clienteId, nombre }))
      if (hayHorasSinDefinir) {
        columnasCliente.push({ clave: SIN_DEFINIR, nombre: 'Sin definir' })
      }

      const filasEmpleado = Array.from(empleadosPorId.values()).sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      )

      const filas = [
        ['Empleado', ...columnasCliente.map((c) => c.nombre), 'Total'],
        ...filasEmpleado.map((emp) => {
          let total = 0
          const horasPorColumna = columnasCliente.map((c) => {
            const horas = emp.porCliente.get(c.clave) || 0
            total += horas
            return horas || ''
          })
          return [emp.nombre, ...horasPorColumna, total]
        }),
      ]

      const totalesPorColumna = columnasCliente.map((c) => {
        let total = 0
        filasEmpleado.forEach((emp) => {
          total += emp.porCliente.get(c.clave) || 0
        })
        return total || ''
      })
      const totalGeneral = filasEmpleado.reduce((suma, emp) => {
        emp.porCliente.forEach((horas) => {
          suma += horas
        })
        return suma
      }, 0)
      filas.push(['Total', ...totalesPorColumna, totalGeneral])

      const hoja = XLSX.utils.aoa_to_sheet(filas)
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, 'Horas extra por cliente')
      XLSX.writeFile(libro, `horas_extra_por_cliente_${desdeStr}_a_${hastaStr}.xlsx`)
    } catch (e: unknown) {
      setError('Error al generar el reporte: ' + (e instanceof Error ? e.message : String(e)))
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-sm text-slate-700 block mb-1">Período (26 al 25, según mes elegido)</label>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
      <button
        onClick={handleGenerar}
        disabled={loading}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Generando...' : 'Descargar horas extra por cliente'}
      </button>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </div>
  )
}
