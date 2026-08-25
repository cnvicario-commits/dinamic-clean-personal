'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES, type Rol } from '@/utils/permisos'

export default function CambiarRolSelect({ perfilId, rolActual }: { perfilId: string; rolActual: Rol | null }) {
  const [rol, setRol] = useState(rolActual ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function cambiar(nuevoRol: string) {
    setRol(nuevoRol)
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: perfilId, rol: nuevoRol }),
      })
      const data = await res.json().catch(() => ({ error: 'El servidor no respondió correctamente. Probá de nuevo en un momento.' }))
      if (!res.ok) {
        setError(data.error ?? 'Error al cambiar el rol.')
        setRol(rolActual ?? '')
        return
      }
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Probá de nuevo.')
      setRol(rolActual ?? '')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <select
        value={rol}
        onChange={(e) => cambiar(e.target.value)}
        disabled={loading}
        className="px-2 py-1 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
      >
        <option value="">Sin rol</option>
        {ROLES.map((r) => (
          <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
        ))}
      </select>
      {error && <p className="text-rose-600 text-xs mt-1">{error}</p>}
    </div>
  )
}
