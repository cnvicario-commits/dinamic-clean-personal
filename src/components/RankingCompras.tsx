'use client'

type Fila = { nombre: string; total: number; cantidadOc: number }

function formatearMoneda(valor: number) {
  return valor.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Ranking simple de magnitud (un solo valor por fila: el total comprado), por
// eso una sola tonalidad (teal, la misma de acciones primarias en el resto de
// la app) alcanza — no hace falta una paleta categórica para esto.
export default function RankingCompras({ filas, vacioTexto }: { filas: Fila[]; vacioTexto: string }) {
  if (filas.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <p className="text-slate-500 text-sm">{vacioTexto}</p>
      </div>
    )
  }

  const maximo = Math.max(...filas.map((f) => f.total), 1)

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3">
      {filas.map((f, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-sm text-slate-700" title={f.nombre}>
            {f.nombre}
            <span className="text-xs text-slate-400"> ({f.cantidadOc} OC)</span>
          </span>
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-teal-600 rounded-full"
              style={{ width: `${(f.total / maximo) * 100}%` }}
              title={`$ ${formatearMoneda(f.total)}`}
            />
          </div>
          <span className="w-32 shrink-0 text-right text-sm font-medium text-slate-900 tabular-nums">
            $ {formatearMoneda(f.total)}
          </span>
        </div>
      ))}
    </div>
  )
}
