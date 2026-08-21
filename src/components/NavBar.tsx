'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

type Enlace = { href: string; label: string }
type Grupo = { id: string; label: string; enlaces: Enlace[] }

const transversales: Enlace[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/resultados', label: 'Resultados' },
]

const grupos: Grupo[] = [
  {
    id: 'rrhh',
    label: 'RRHH',
    enlaces: [
      { href: '/empleados', label: 'Empleados' },
      { href: '/ausencias', label: 'Novedades' },
      { href: '/asignaciones', label: 'Asignaciones' },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    enlaces: [
      { href: '/proveedores', label: 'Proveedores' },
      { href: '/articulos', label: 'Artículos' },
      { href: '/pedidos-compra', label: 'Pedidos de compra' },
      { href: '/panel-compras', label: 'Panel de compras' },
      { href: '/ordenes-compra', label: 'Órdenes de compra' },
      { href: '/pedidos-deposito', label: 'Pedidos a depósito' },
    ],
  },
]

function esActivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function ChevronAbajo({ className = '' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export default function NavBar() {
  const [abierto, setAbierto] = useState(false) // menú mobile (hamburguesa)
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set())
  const pathname = usePathname()

  // Si la pantalla activa pertenece a un grupo, ese grupo arranca expandido
  // en el sidebar, para que el link activo sea visible sin tener que
  // desplegarlo a mano.
  useEffect(() => {
    const grupoActivo = grupos.find((g) => g.enlaces.some((e) => esActivo(pathname, e.href)))
    if (grupoActivo) {
      setGruposAbiertos((prev) => (prev.has(grupoActivo.id) ? prev : new Set(prev).add(grupoActivo.id)))
    }
  }, [pathname])

  function toggleGrupo(id: string) {
    setGruposAbiertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const linkStyle = (activo: boolean) =>
    `text-sm transition-colors ${activo ? 'text-white font-medium' : 'text-slate-300 hover:text-white'}`

  // El portal es la puerta de entrada antes de los módulos, con su propio
  // diseño de pantalla completa: no lleva el sidebar al costado. Los hooks
  // de arriba se siguen ejecutando siempre (mismo orden en cada render),
  // solo se omite el render.
  if (pathname === '/portal') return null

  return (
    <>
      {/* Barra superior: solo mobile (< md), con menú hamburguesa */}
      <nav className="print:hidden md:hidden bg-slate-900 text-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-4 py-4">
          <Link href="/portal" className="font-bold text-teal-400">
            Dinamic Clean
          </Link>
          <button onClick={() => setAbierto(!abierto)} className="p-2 text-slate-100" aria-label="Abrir menú">
            {abierto ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {abierto && (
          <div className="flex flex-col px-4 pb-4 gap-3 border-t border-slate-800 pt-3">
            {transversales.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setAbierto(false)}
                className={linkStyle(esActivo(pathname, link.href))}
              >
                {link.label}
              </Link>
            ))}
            {grupos.map((grupo) => (
              <div key={grupo.id} className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">{grupo.label}</p>
                {grupo.enlaces.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setAbierto(false)}
                    className={`pl-3 ${linkStyle(esActivo(pathname, link.href))}`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
            <LogoutButton />
          </div>
        )}
      </nav>

      {/* Sidebar lateral: desde md en adelante */}
      <aside className="print:hidden hidden md:flex md:flex-col md:w-60 md:shrink-0 md:sticky md:top-0 md:self-start md:h-screen bg-slate-900 text-slate-100">
        <div className="px-5 py-5 border-b border-slate-800">
          <Link href="/portal" className="font-bold text-teal-400">
            Dinamic Clean
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {transversales.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-3 py-2 rounded-md ${linkStyle(esActivo(pathname, link.href))}`}
            >
              {link.label}
            </Link>
          ))}

          {grupos.map((grupo) => {
            const grupoActivo = grupo.enlaces.some((e) => esActivo(pathname, e.href))
            const expandido = gruposAbiertos.has(grupo.id)
            return (
              <div key={grupo.id}>
                <button
                  type="button"
                  onClick={() => toggleGrupo(grupo.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md ${linkStyle(grupoActivo)}`}
                >
                  {grupo.label}
                  <ChevronAbajo className={`transition-transform ${expandido ? 'rotate-180' : ''}`} />
                </button>
                {expandido && (
                  <div className="ml-3 mt-1 mb-1 flex flex-col gap-1 border-l border-slate-700 pl-3">
                    {grupo.enlaces.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-3 py-2 rounded-md ${linkStyle(esActivo(pathname, link.href))}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-3 py-4 border-t border-slate-800">
          <LogoutButton />
        </div>
      </aside>
    </>
  )
}
