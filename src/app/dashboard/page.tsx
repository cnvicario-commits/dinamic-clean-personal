import { createClient } from '@/utils/supabase/server'
import ClientesComparacion from '@/components/ClientesComparacion'
import RankingCompras from '@/components/RankingCompras'
import { type RelOne, relOne } from '@/lib/supabase-rel'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; comprasDesde?: string; comprasHasta?: string }>
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

  // Compras por cliente/proveedor: período propio (desde/hasta), independiente
  // del selector de "Mes" de arriba, que es específico de RRHH. Por defecto
  // muestra el mes en curso hasta hoy.
  const hoyStr = hoy.toISOString().split('T')[0]
  const primerDiaMesActual = `${mesActual}-01`
  const comprasDesde = params.comprasDesde || primerDiaMesActual
  const comprasHasta = params.comprasHasta || hoyStr

  const { data: ordenesPeriodo } = await supabase
    .from('ordenes_compra')
    .select(
      'id, cliente_id, proveedor_id, clientes(nombre), proveedores(razon_social), ordenes_compra_items(cantidad, precio_unitario)'
    )
    .gte('fecha', comprasDesde)
    .lte('fecha', comprasHasta)
    .in('estado', ['enviada', 'recepcionada']) // los borradores todavía no son una compra confirmada

  type AcumuladoCompras = { nombre: string; total: number; cantidadOc: number }
  type OrdenPeriodo = {
    id: string
    cliente_id: string
    proveedor_id: string
    clientes: RelOne<{ nombre: string }>
    proveedores: RelOne<{ razon_social: string }>
    ordenes_compra_items: { cantidad: number; precio_unitario: number }[] | null
  }
  type AsignacionActiva = {
    cliente_id: string
    empleados: RelOne<{ horas_contrato: number | null }>
  }
  type AusenciaMes = {
    empleado_id: string
    codigo: string
    fecha: string
    empleados: RelOne<{ nombre_apellido: string }>
  }
  const porCliente: Record<string, AcumuladoCompras> = {}
  const porProveedor: Record<string, AcumuladoCompras> = {}
  let totalComprado = 0

  ;((ordenesPeriodo ?? []) as OrdenPeriodo[]).forEach((o) => {
    const totalOc = (o.ordenes_compra_items ?? []).reduce(
      (acc, i) => acc + i.cantidad * i.precio_unitario,
      0
    )
    totalComprado += totalOc

    const nombreCliente = relOne(o.clientes)?.nombre ?? 'Sin cliente'
    if (!porCliente[o.cliente_id]) porCliente[o.cliente_id] = { nombre: nombreCliente, total: 0, cantidadOc: 0 }
    porCliente[o.cliente_id].total += totalOc
    porCliente[o.cliente_id].cantidadOc += 1

    const nombreProveedor = relOne(o.proveedores)?.razon_social ?? 'Sin proveedor'
    if (!porProveedor[o.proveedor_id]) porProveedor[o.proveedor_id] = { nombre: nombreProveedor, total: 0, cantidadOc: 0 }
    porProveedor[o.proveedor_id].total += totalOc
    porProveedor[o.proveedor_id].cantidadOc += 1
  })

  const rankingClientesCompras = Object.values(porCliente).sort((a, b) => b.total - a.total)
  const rankingProveedoresCompras = Object.values(porProveedor).sort((a, b) => b.total - a.total)
  const cantidadOcPeriodo = ordenesPeriodo?.length ?? 0

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
  ;(asignacionesActivas as AsignacionActiva[] | null)?.forEach((a) => {
    if (!realPorCliente[a.cliente_id]) {
      realPorCliente[a.cliente_id] = { real4: 0, real8: 0 }
    }
    const horas = relOne(a.empleados)?.horas_contrato
    if (horas === 4) {
      realPorCliente[a.cliente_id].real4++
    } else if (horas === 8 || horas === 1) {
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

  // Ausencias del mes seleccionado (cualquier código distinto de "P" = presente)
  const { data: asistenciasMes } = await supabase
    .from('asistencias')
    .select('empleado_id, codigo, fecha, empleados(nombre_apellido)')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  const { count: totalEmpleadosActivos } = await supabase
    .from('empleados')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true)

  const ausenciasMes = asistenciasMes?.filter((a) => a.codigo !== 'P') || []
  const totalAusencias = ausenciasMes.length
  const totalInjustificadas = ausenciasMes.filter((a) => a.codigo === 'A').length
  const totalJustificadas = totalAusencias - totalInjustificadas

  const rankingMap: Record<string, { nombre: string; cantidad: number }> = {}
  ;(ausenciasMes as AusenciaMes[]).forEach((a) => {
    const nombre = relOne(a.empleados)?.nombre_apellido || 'Sin nombre'
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
          <input type="hidden" name="comprasDesde" value={comprasDesde} />
          <input type="hidden" name="comprasHasta" value={comprasHasta} />
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

      <div className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Compras
          </h2>
          <form className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="mes" value={mes} />
            <label className="text-sm text-slate-600">Desde:</label>
            <input
              type="date"
              name="comprasDesde"
              defaultValue={comprasDesde}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <label className="text-sm text-slate-600">Hasta:</label>
            <input
              type="date"
              name="comprasHasta"
              defaultValue={comprasHasta}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
            <button type="submit" className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg">
              Ver
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total comprado en el período</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              $ {totalComprado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Órdenes de compra (enviadas + recepcionadas)</p>
            <p className="text-2xl font-bold text-slate-900">{cantidadOcPeriodo}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Compras por cliente
            </h3>
            <RankingCompras filas={rankingClientesCompras} vacioTexto="Sin compras en el período elegido." />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Compras por proveedor
            </h3>
            <RankingCompras filas={rankingProveedoresCompras} vacioTexto="Sin compras en el período elegido." />
          </div>
        </div>
      </div>
    </div>
  )
}