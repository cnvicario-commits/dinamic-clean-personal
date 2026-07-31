'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/utils/supabase/client'

const DIAS_SEMANA = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const CODIGOS_TOTAL: { codigo: string; header: string }[] = [
  { codigo: 'P', header: 'PRESENTE' },
  { codigo: 'A', header: 'AUS SIN JUST' },
  { codigo: 'FNT', header: 'FERIADO NO TRAB' },
  { codigo: 'FT', header: 'FERIADO  TRAB' },
  { codigo: 'ENF', header: 'ENF' },
  { codigo: 'ART', header: 'ART' },
  { codigo: 'S', header: 'SUSP' },
  { codigo: 'LE', header: 'LIC.  EXAMEN' },
  { codigo: 'LN', header: 'LIC. NAC' },
  { codigo: 'LF', header: 'LIC. FALLEC.' },
  { codigo: 'LM', header: 'LIC. MATRIM' },
  { codigo: 'LV', header: 'LIC. VARIAS' },
  { codigo: 'VAC', header: 'VACACIONES' },
]

function formatoFecha(d: Date) {
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export default function ReporteBejerman() {
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

      const { data: empleados } = await supabase
        .from('empleados')
        .select('id, nombre_apellido, legajo, empresa')
        .order('nombre_apellido')

      const { data: asignaciones } = await supabase
        .from('asignaciones')
        .select('empleado_id, cliente_id')
        .is('fecha_hasta', null)

      const { data: clientes } = await supabase
        .from('clientes')
        .select('id, nombre, codigo_costos')

      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('empleado_id, fecha, codigo')
        .gte('fecha', desdeStr)
        .lte('fecha', hastaStr)

      if (!empleados || empleados.length === 0) {
        setError('No hay empleados cargados.')
        setLoading(false)
        return
      }

      const dias: Date[] = []
      const cursor = new Date(desde)
      while (cursor <= hasta) {
        dias.push(new Date(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }

      const clientesPorId = new Map((clientes || []).map((c) => [c.id, c]))
      const asignacionPorEmpleado = new Map((asignaciones || []).map((a) => [a.empleado_id, a.cliente_id]))

      const filaDiasSemana: Record<string, any> = { SERVICIO: '', E: '', LEGAJO: '', 'Apellido y Nombres': '' }
      dias.forEach((d) => {
        filaDiasSemana[String(d.getDate())] = DIAS_SEMANA[d.getDay()]
      })
      CODIGOS_TOTAL.forEach(({ header }) => {
        filaDiasSemana[header] = ''
      })
      filaDiasSemana['c costos'] = ''

      const filas = empleados.map((emp) => {
        const asistenciasEmp = (asistencias || []).filter((a) => a.empleado_id === emp.id)
        const codigoPorFecha = new Map(asistenciasEmp.map((a) => [a.fecha, a.codigo]))

        const clienteId = asignacionPorEmpleado.get(emp.id)
        const cliente = clienteId ? clientesPorId.get(clienteId) : null

        const fila: Record<string, any> = {
          SERVICIO: cliente?.nombre || '',
          E: emp.empresa === 'MORAL' ? 'M' : 'D',
          LEGAJO: emp.legajo || '',
          'Apellido y Nombres': emp.nombre_apellido,
        }

        dias.forEach((d) => {
          const fechaStr = formatoFecha(d)
          fila[String(d.getDate())] = codigoPorFecha.get(fechaStr) || ''
        })

        CODIGOS_TOTAL.forEach(({ codigo, header }) => {
          fila[header] = asistenciasEmp.filter((a) => a.codigo === codigo).length
        })

        fila['c costos'] = cliente?.codigo_costos || ''

        return fila
      })

      const hoja = XLSX.utils.json_to_sheet([filaDiasSemana, ...filas])
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, 'Reporte Bejerman')
      XLSX.writeFile(libro, `reporte_bejerman_${desdeStr}_a_${hastaStr}.xlsx`)
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
        {loading ? 'Generando...' : 'Descargar reporte Bejerman'}
      </button>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </div>
  )
}