'use client'

type Estado = 'borrador' | 'enviada' | 'recepcionada'

const ESTILOS: Record<Estado, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  enviada: 'bg-amber-100 text-amber-700',
  recepcionada: 'bg-emerald-100 text-emerald-700',
}
const ETIQUETAS: Record<Estado, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  recepcionada: 'Recepcionada',
}

export default function EstadoBadge({ estado }: { estado: Estado }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${ESTILOS[estado]}`}>
      {ETIQUETAS[estado]}
    </span>
  )
}
