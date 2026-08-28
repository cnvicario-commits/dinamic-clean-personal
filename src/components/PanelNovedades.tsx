import Link from 'next/link'

export type ItemNovedad = {
  oportunidadId: string
  prospectoNombre: string
  cantidad: number
  usuario: string
  nota: string | null
  creadoEn: string
}

function formatearRelativo(fecha: string): string {
  const horas = Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60))
  if (horas < 1) return 'hace instantes'
  if (horas < 24) return `hace ${horas}h`
  return `hace ${Math.floor(horas / 24)}d`
}

// Resumen de seguimientos cargados por otros usuarios que este usuario
// todavía no vio (ver src/utils/novedades.ts). Sin novedades no se muestra
// nada, para no ocupar lugar con un panel vacío.
export default function PanelNovedades({ items }: { items: ItemNovedad[] }) {
  if (items.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5">
      <h2 className="text-sm font-semibold text-amber-800 mb-2">Novedades ({items.length})</h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.oportunidadId}
            href={`/ventas/${item.oportunidadId}`}
            className="flex items-center justify-between gap-3 text-sm bg-white/60 hover:bg-white rounded-md px-3 py-2 transition-colors"
          >
            <span className="text-slate-700">
              <span className="font-medium">{item.prospectoNombre}</span> — {item.usuario}:{' '}
              {item.cantidad > 1 ? `${item.cantidad} novedades nuevas` : item.nota ?? 'agregó un seguimiento'}
            </span>
            <span className="text-xs text-amber-700 whitespace-nowrap">{formatearRelativo(item.creadoEn)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
