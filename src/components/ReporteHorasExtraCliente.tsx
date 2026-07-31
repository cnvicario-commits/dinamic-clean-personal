'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'

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
  const supabase = createClient()

  const handleGenerar = async () => {
    setError('')
    setLoading(true)
    try {
      const [anioSel, mesSel] = mes.split('-').map(Number)
      const desde = new Date(anioSel, mesSel - 2, 26)
      const hasta = new Date(anioSel, mesSel - 1, 25)
      const desdeStr = formatoFecha(desde)
      const hastaStr = formatoFecha(hasta)

      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('empleado_id, horas_extras, cliente_destino_id, cliente_horas_extra_id, empleados(nombre_apellido)')
        .gt('horas_extras', 0)
        .gte('fecha', desdeStr)
        .lte('fecha', hastaStr)

      const { data: asignaciones } = await supabase
        .from('asignaciones')
        .select('empleado_id, cliente_id')
        .is('fecha_hasta', null)

      const { data: clientes } = await supabase.from('clientes').select('id, nombre')

      if (!asistencias || asistencias.length === 0) {
        setError('No hay horas extra cargadas en ese período.')
        setLoading(false)
        return
      }

      const clientesPorId = new Map((clientes || []).map((c) => [c.id, c]))
      const asignacionesPorEmpleado = new Map<string, string[]>()
      ;(asignaciones || []).forEach((a) => {
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

      const acumulado = new Map<string, { empleado: string; cliente: string; horas: number }>()
      asistencias.forEach((a: any) => {
        const clienteId = resolverClienteId(a)
        const clienteNombre = clienteId ? clientesPorId.get(clienteId)?.nombre || 'Sin definir' : 'Sin definir'
        const empleadoNombre = a.empleados?.nombre_apellido || 'Sin nombre'
        const clave = `${a.empleado_id}::${clienteId || ''}`
        const previo = acumulado.get(clave)
        if (previo) {
          previo.horas += a.horas_extras
        } else {
          acumulado.set(clave, { empleado: empleadoNombre, cliente: clienteNombre, horas: a.horas_extras })
        }
      })

      const filasDatos = Array.from(acumulado.values()).sort(
        (a, b) => a.empleado.localeCompare(b.empleado) || a.cliente.localeCompare(b.cliente)
      )

      const filas = [
        ['Empleado', 'Cliente', 'Horas'],
        ...filasDatos.map((f) => [f.empleado, f.cliente, f.horas]),
      ]

      const hoja = XLSX.utils.aoa_to_sheet(filas)
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, 'Horas extra por cliente')
      XLSX.writeFile(libro, `horas_extra_por_cliente_${desdeStr}_a_${hastaStr}.xlsx`)
    } catch (e: any) {
      setError('Error al generar el reporte: ' + e.message)
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
