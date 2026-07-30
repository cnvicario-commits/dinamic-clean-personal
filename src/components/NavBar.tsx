import Link from 'next/link'
import LogoutButton from './LogoutButton'

export default function NavBar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 bg-slate-900 text-slate-100 shadow-sm">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-bold text-teal-400 mr-2">
          Dinamic Clean
        </Link>
        <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white transition-colors">
          Dashboard
        </Link>
        <Link href="/clientes" className="text-sm text-slate-300 hover:text-white transition-colors">
          Clientes
        </Link>
        <Link href="/empleados" className="text-sm text-slate-300 hover:text-white transition-colors">
          Empleados
        </Link>
        <Link href="/ausencias" className="text-sm text-slate-300 hover:text-white transition-colors">
          Ausencias
        </Link>
        <Link href="/asignaciones" className="text-sm text-slate-300 hover:text-white transition-colors">
          Asignaciones
        </Link>
      </div>
      <LogoutButton />
    </nav>
  )
}