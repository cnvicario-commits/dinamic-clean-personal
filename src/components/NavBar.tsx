import Link from 'next/link'

export default function NavBar() {
  return (
    <nav style={{ display: 'flex', gap: '1.5rem', padding: '1rem 2rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
      <Link href="/" style={{ textDecoration: 'none', color: '#000', fontWeight: 'bold' }}>Dinamic Clean</Link>
      <Link href="/clientes" style={{ textDecoration: 'none', color: '#333' }}>Clientes</Link>
      <Link href="/empleados" style={{ textDecoration: 'none', color: '#333' }}>Empleados</Link>
      <Link href="/ausencias" style={{ textDecoration: 'none', color: '#333' }}>Ausencias</Link>
    </nav>
  )
}