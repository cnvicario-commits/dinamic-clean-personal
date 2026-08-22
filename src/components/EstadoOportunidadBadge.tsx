'use client'
import type { EstadoOportunidad } from '@/types/crm'

// Separado de EstadoBadge.tsx (que está tipado a los 3 estados de
// pedidos/OC/depósito) porque son dominios de estado distintos — mismo
// criterio ya usado para EstadoProcesamientoBadge.tsx.
const ESTILOS: Record<EstadoOportunidad, string> = {
  en_seguimiento: 'bg-amber-100 text-amber-700',
  aceptado: 'bg-emerald-100 text-emerald-700',
  rechazado: 'bg-rose-100 text-rose-700',
  en_espera: 'bg-slate-100 text-slate-700',
}
const ETIQUETAS: Record<EstadoOportunidad, string> = {
  en_seguimiento: 'En seguimiento',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  en_espera: 'En espera',
}

export default function EstadoOportunidadBadge({ estado }: { estado: EstadoOportunidad }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${ESTILOS[estado]}`}>
      {ETIQUETAS[estado]}
    </span>
  )
}
