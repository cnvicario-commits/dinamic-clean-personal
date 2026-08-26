import { armarLinkWhatsapp } from '@/utils/whatsapp'

// No es un client component: es un <a> plano, no necesita estado ni
// handlers — funciona igual en la ficha (server component) que en la
// tarjeta del Kanban (client component).
export default function BotonWhatsApp({
  telefono,
  mensaje,
  className,
  classNameDeshabilitado,
}: {
  telefono: string | null | undefined
  mensaje: string
  className?: string
  classNameDeshabilitado?: string
}) {
  const link = armarLinkWhatsapp(telefono, mensaje)

  if (!link) {
    // Siempre visible (a pedido), pero sin acción: así queda claro que la
    // opción existe y por qué no se puede usar todavía para este prospecto.
    return (
      <span
        title="Este prospecto no tiene un teléfono cargado"
        className={
          classNameDeshabilitado ??
          'inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 text-xs font-medium rounded-lg cursor-not-allowed'
        }
      >
        Enviar WhatsApp
      </span>
    )
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors'
      }
    >
      Enviar WhatsApp
    </a>
  )
}
