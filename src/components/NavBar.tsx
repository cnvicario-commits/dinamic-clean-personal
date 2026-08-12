'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'

type Enlace = { href: string; label: string }
type Grupo = { id: string; label: string; enlaces: Enlace[] }

const transversales: Enlace[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/empresas', label: 'Empresas' },
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

export default function NavBar() {
  const [abierto, setAbierto] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setMenuAbierto(null)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  const linkStyle = (activo: boolean) =>
    `text-sm transition-colors ${activo ? 'text-white font-medium' : 'text-slate-300 hover:text-white'}`

  return (
    <nav className="print:hidden bg-slate-900 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <Link href="/dashboard" className="font-bold text-teal-400">
          Dinamic Clean
        </Link>

        <div ref={contenedorRef} className="hidden md:flex items-center gap-6">
          {transversales.map((link) => (
            <Link key={link.href} href={link.href} className={linkStyle(esActivo(pathname, link.href))}>
              {link.label}
            </Link>
          ))}

          {grupos.map((grupo) => {
            const grupoActivo = grupo.enlaces.some((e) => esActivo(pathname, e.href))
            return (
              <div key={grupo.id} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuAbierto(menuAbierto === grupo.id ? null : grupo.id)}
                  className={`flex items-center gap-1 ${linkStyle(grupoActivo)}`}
                >
                  {grupo.label}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuAbierto === grupo.id && (
                  <div className="absolute left-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-20">
                    {grupo.enlaces.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuAbierto(null)}
                        className={`block px-4 py-2.5 text-sm border-b border-slate-700 last:border-0 transition-colors ${
                          esActivo(pathname, link.href)
                            ? 'text-white bg-slate-700'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700'
                        }`}
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

        <div className="hidden md:block">
          <LogoutButton />
        </div>

        <button
          onClick={() => setAbierto(!abierto)}
          className="md:hidden p-2 text-slate-100"
          aria-label="Abrir menú"
        >
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
        <div className="md:hidden flex flex-col px-4 pb-4 gap-3 border-t border-slate-800 pt-3">
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
  )
}
