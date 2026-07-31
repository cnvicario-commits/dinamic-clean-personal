import { createClient } from '@/utils/supabase/server'
import ClientesComparacion from '@/components/ClientesComparacion'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const supabase = await createClient()
  const params = await searchParams

  const hoy = new Date()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  const mes = params.mes || mesActual

  const [anio, mesNum] = mes.split('-').map(Number)
  const fechaInicio = `${mes}-01`
  const ultimoDia = new Date(anio, mesNum, 0).getDate()
  const fechaFin = `${mes}-${String(ultimoDia).padStart(2, '0')}`

  // Clientes con su presupuesto
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, presupuesto_4hs, presupuesto_8hs')

  // Asignaciones activas, con horas de contrato del empleado
  const { data: asignacionesActivas } = await supabase
    .from('asignaciones')
    .select('cliente_id, empleados(horas_contrato)')
    .is('fecha_hasta', null)

  const realPorCliente: Record<string, { real4: number; real8: number }> = {}
  asignacionesActivas?.forEach((a: any) => {
    if (!realPorCliente[a.cliente_id]) {
      realPorCliente[a.cliente_id] = { real4: 0, real8: 0 }
    }
    if (a.empleados?.horas_contrato === 4) {
      realPorCliente[a.cliente_id].real4++
    } else if (a.empleados?.horas_contrato === 8 || a.empleados?.horas_contrato === 1) {
      realPorCliente[a.cliente_id].real8++
    }
  })

  const comparacion = (clientes || []).map((c) => ({
    nombre: c.nombre,
    presupuesto4: c.presupuesto_4hs || 0,
    presupuesto8: c.presupuesto_8hs || 0,
    real4: realPorCliente[c.id]?.real4 || 0,
    real8: realPorCliente[c.id]?.real8 || 0,
  }))

  // Ausencias del mes seleccionado
  const { data: ausenciasMes } = await supabase
    .from('ausencias')
    .select('empleado_id, justificada, fecha, empleados(nombre_apellido)')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  const { count: totalEmpleadosActivos } = await supabase
    .from('empleados')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true)

  const totalAusencias = ausenciasMes?.length || 0
  const totalJustificadas = ausenciasMes?.filter((a) => a.justificada).length || 0
  const totalInjustificadas = totalAusencias - totalJustificadas

  const rankingMap: Record<string, { nombre: string; cantidad: number }> = {}
  ausenciasMes?.forEach((a: any) => {
    const nombre = a.empleados?.nombre_apellido || 'Sin nombre'
    if (!rankingMap[a.empleado_id]) {
      rankingMap[a.empleado_id] = { nombre, cantidad: 0 }
    }
    rankingMap[a.empleado_id].cantidad++
  })
  const ranking = Object.values(rankingMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10)

  const tasaAusentismo = totalEmpleadosActivos
    ? ((totalAusencias / totalEmpleadosActivos) * 100).toFixed(1)
    : '0'

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <form className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Mes:</label>
          <input type="month" name="mes" defaultValue={mes} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm" />
          <button type="submit" className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg">
            Ver
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ausencias del mes</p>
          <p className="text-2xl font-bold text-slate-900">{totalAusencias}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Justificadas</p>
          <p className="text-2xl font-bold text-emerald-600">{totalJustificadas}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Injustificadas</p>
          <p className="text-2xl font-bold text-rose-600">{totalInjustificadas}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tasa de ausentismo</p>
          <p className="text-2xl font-bold text-slate-900">{tasaAusentismo}%</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Presupuesto vs. real por cliente
        </h2>
        <ClientesComparacion datos={comparacion} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Ranking de ausencias (este mes)
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden max-w-md">
          <table className="w-full text-sm">
            <tbody>
              {ranking.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-800">{r.nombre}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-700">{r.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ranking.length === 0 && (
            <p className="text-slate-500 text-sm p-4">Sin ausencias registradas este mes.</p>
          )}
        </div>
      </div>
    </div>
  )
}