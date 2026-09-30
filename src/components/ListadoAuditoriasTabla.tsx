'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Audit } from '@/lib/api/generated'

type Perfil = { id: string; nombre_completo: string }

function formatearFecha(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

export default function ListadoAuditoriasTabla({
  auditorias,
  supervisores,
  total,
  filters,
}: {
  auditorias: Audit[]
  supervisores: Perfil[]
  total: number
  filters: { supervisorId: string; desde: string; hasta: string; q: string }
}) {
  const router = useRouter()

  function navegarFiltros(next: {
    supervisorId?: string
    desde?: string
    hasta?: string
    q?: string
  }) {
    const params = new URLSearchParams()
    const supervisorId = next.supervisorId ?? filters.supervisorId
    const desde = next.desde ?? filters.desde
    const hasta = next.hasta ?? filters.hasta
    const q = (next.q ?? filters.q).trim()
    if (supervisorId) params.set('supervisorId', supervisorId)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (q) params.set('q', q)
    params.set('page', '1')
    router.push(`/auditorias/listado?${params.toString()}`)
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            navegarFiltros({ q: String(data.get('q') ?? '') })
          }}
        >
          <input
            name="q"
            type="text"
            defaultValue={filters.q}
            placeholder="Buscar por cliente o sitio..."
            className={`${selectStyle} w-64`}
          />
          <button type="submit" className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            Buscar
          </button>
        </form>
        <select
          value={filters.supervisorId}
          onChange={(e) => navegarFiltros({ supervisorId: e.target.value })}
          className={selectStyle}
        >
          <option value="">Todos los supervisores</option>
          {supervisores.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre_completo}</option>
          ))}
        </select>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Desde</label>
          <input
            type="date"
            value={filters.desde}
            onChange={(e) => navegarFiltros({ desde: e.target.value })}
            className={selectStyle}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Hasta</label>
          <input
            type="date"
            value={filters.hasta}
            onChange={(e) => navegarFiltros({ hasta: e.target.value })}
            className={selectStyle}
          />
        </div>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Auditorías realizadas ({total})
      </h2>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Sitio</th>
              <th className="px-4 py-3 font-medium">Supervisor</th>
              <th className="px-4 py-3 font-medium">Evaluación general</th>
              <th className="px-4 py-3 font-medium">No conformidades</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {auditorias.map((a) => {
              const noConformes = a.no_conformidades
              return (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-600">{formatearFecha(a.fecha_realizada)}</td>
                  <td className="px-4 py-3 text-slate-800">{a.cliente_domicilios?.clientes?.nombre ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{a.cliente_domicilios?.alias ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{a.perfiles?.nombre_completo ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{a.evaluacion_general ?? '-'}</td>
                  <td className="px-4 py-3">
                    {noConformes > 0 ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-rose-100 text-rose-700">{noConformes}</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/auditorias/${a.id}`} className="text-teal-600 hover:underline">
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {auditorias.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay auditorías que coincidan.</p>
      )}
    </div>
  )
}
