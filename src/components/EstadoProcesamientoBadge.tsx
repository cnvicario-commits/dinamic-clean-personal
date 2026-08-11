// Estado calculado (no es una columna real, ver panel-compras/page.tsx y
// panel-compras/[id]/page.tsx) — por eso es un badge propio, separado de
// EstadoBadge.tsx, que está tipado estrictamente a los 3 estados reales del
// flujo (borrador/enviada/recepcionada).
export default function EstadoProcesamientoBadge({ procesado }: { procesado: boolean }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${
        procesado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {procesado ? 'Procesado' : 'Pendiente'}
    </span>
  )
}
