import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import LogoutButton from '@/components/LogoutButton'

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

type Modulo = {
  href: string
  nombre: string
  descripcion: string
  fondo: string
  colorIcono: string
  colorTexto: string
  icono: React.ReactNode
  nuevo?: boolean
}

const MODULOS: Modulo[] = [
  {
    href: '/empleados',
    nombre: 'Recursos Humanos',
    descripcion: 'Empleados, novedades y asignaciones.',
    fondo: 'bg-[#e3fbf5]',
    colorIcono: 'bg-[#00a99a]',
    colorTexto: 'text-[#00a99a]',
    icono: (
      <>
        <path d="M17 20c0-2.8-2.2-5-5-5H9c-2.8 0-5 2.2-5 5" />
        <circle cx="9" cy="8" r="3.2" />
        <path d="M16.7 14.6c1.9.4 3.3 2.1 3.3 4.4" />
        <path d="M13.6 4.4a3 3 0 0 1 0 5.8" />
      </>
    ),
  },
  {
    href: '/ventas',
    nombre: 'Ventas',
    descripcion: 'Seguimiento de cotizaciones y prospectos.',
    fondo: 'bg-[#e1f1fc]',
    colorIcono: 'bg-[#0388cc]',
    colorTexto: 'text-[#0388cc]',
    nuevo: true,
    icono: (
      <>
        <path d="M4 18 9 12l4 3 6-7" />
        <path d="M15 7h5v5" />
      </>
    ),
  },
  {
    href: '/pedidos-compra',
    nombre: 'Compras',
    descripcion: 'Proveedores, artículos y pedidos de compra.',
    fondo: 'bg-[#ecf7db]',
    colorIcono: 'bg-[#5c9600]',
    colorTexto: 'text-[#5c9600]',
    icono: (
      <>
        <path d="M3.5 8 12 4l8.5 4-8.5 4-8.5-4Z" />
        <path d="M3.5 8v8l8.5 4 8.5-4V8" />
        <path d="M12 12v8" />
      </>
    ),
  },
  {
    href: '/auditorias',
    nombre: 'Auditoría y Calidad',
    descripcion: 'Checklist de auditorías, planificación y planes de acción por sitio.',
    fondo: 'bg-[#f1e9fb]',
    colorIcono: 'bg-[#7c3aed]',
    colorTexto: 'text-[#7c3aed]',
    nuevo: true,
    icono: (
      <>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    href: '/resultados',
    nombre: 'Resultados',
    descripcion: 'Indicadores y reportes del negocio.',
    fondo: 'bg-[#fbf1dc]',
    colorIcono: 'bg-[#a16207]',
    colorTexto: 'text-[#a16207]',
    icono: (
      <>
        <path d="M4 21h16" />
        <rect x="6" y="13" width="3" height="6" rx="0.6" />
        <rect x="11" y="9" width="3" height="10" rx="0.6" />
        <rect x="16" y="5" width="3" height="14" rx="0.6" />
      </>
    ),
  },
]

const DATOS = [
  {
    href: '/clientes',
    nombre: 'Clientes',
    icono: (
      <>
        <path d="M17 20c0-2.8-2.2-5-5-5H9c-2.8 0-5 2.2-5 5" />
        <circle cx="9" cy="8" r="3.2" />
      </>
    ),
  },
  {
    href: '/empresas',
    nombre: 'Empresas',
    icono: (
      <>
        <path d="M3 21V7l9-4 9 4v14" />
        <path d="M9 21v-6h6v6" />
      </>
    ),
  },
]

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const email = session.user.email ?? 'usuario'

  return (
    <div className="font-sans min-h-screen bg-[#0f172b] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 sm:px-10 pt-7 pb-2">
        <div>
          <p className="text-xl font-extrabold tracking-wide">
            <span className="text-[#00d5be]">PORTAL</span> <span className="text-white">DINAMIC</span>
          </p>
          <p className="text-sm text-[#8b9bb4] mt-0.5">Hola, {email}</p>
        </div>
        <div className="self-end sm:self-auto">
          <LogoutButton />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 sm:px-10 pt-9 pb-14">
        <p className="text-[#8b9bb4] text-xs font-semibold tracking-[1.5px] uppercase mb-1.5">Elegí un módulo</p>
        <h1 className="text-white text-2xl sm:text-[28px] font-bold mb-8 text-center">¿Qué querés hacer hoy?</h1>

        <div className="w-full max-w-[1180px] grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
          {MODULOS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`rounded-[18px] p-6 flex flex-col gap-4 shadow-[0_18px_34px_-18px_rgba(0,0,0,0.45)] transition-transform hover:-translate-y-1 ${m.fondo}`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${m.colorIcono}`}>
                <svg className="h-[18px] w-[18px] text-white" {...svgProps}>
                  {m.icono}
                </svg>
              </div>
              <h2 className="text-[#0f172b] text-lg font-bold">{m.nombre}</h2>
              <p className="text-[#64748b] text-[13.5px] leading-relaxed">{m.descripcion}</p>
              <div className="flex items-center justify-between mt-auto pt-1.5">
                {m.nuevo ? (
                  <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#c7e6f8] text-[#0b5c8c]">
                    Nuevo
                  </span>
                ) : (
                  <span />
                )}
                <svg className={`h-5 w-5 ${m.colorTexto}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        <div className="w-full max-w-[1180px] mt-8 flex items-center gap-3.5 flex-wrap">
          <span className="text-[#67768f] text-xs font-bold tracking-[1.2px] uppercase">Datos</span>
          {DATOS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.14] text-[#d7deea] text-[13.5px] font-semibold hover:text-white hover:border-white/[0.28] transition-colors"
            >
              <svg className="h-[15px] w-[15px] text-[#8b9bb4]" {...svgProps}>
                {d.icono}
              </svg>
              {d.nombre}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
