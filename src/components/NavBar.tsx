'use client'
import { useState } from 'react'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

export default function NavBar() {
  const [abierto, setAbierto] = useState(false)

  const enlaces = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/clientes', label: 'Clientes' },
    { href: '/empleados', label: 'Empleados' },
    { href: '/ausencias', label: 'Novedades' },
    { href: '/asignaciones', label: 'Asignaciones' },
  ]

  return (
    <nav className="bg-slate-900 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <Link href="/dashboard" className="font-bold text-teal-400">
          Dinamic Clean
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {enlaces.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
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
          {enlaces.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setAbierto(false)}
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <LogoutButton />
        </div>
      )}
    </nav>
  )
}