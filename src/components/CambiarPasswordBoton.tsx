'use client'
import { useState } from 'react'
import { PASSWORD_MIN_LENGTH } from '@/lib/password-policy'

export default function CambiarPasswordBoton({ perfilId }: { perfilId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  async function guardar() {
    setError('')
    setOk(false)
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: perfilId, password }),
      })
      const data = await res.json().catch(() => ({
        error: 'El servidor no respondió correctamente. Probá de nuevo en un momento.',
      }))
      if (!res.ok) {
        setError(data.error ?? 'Error al cambiar la contraseña.')
        return
      }
      setPassword('')
      setOk(true)
    } catch {
      setError('No se pudo conectar con el servidor. Probá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true)
          setOk(false)
          setError('')
        }}
        className="text-xs text-teal-600 hover:underline"
      >
        Cambiar contraseña
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña nueva"
          className="px-2 py-1 border border-slate-300 rounded-md text-sm w-36 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="button"
          onClick={guardar}
          disabled={loading}
          className="text-xs text-teal-600 font-medium hover:underline disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false)
            setPassword('')
            setError('')
          }}
          className="text-xs text-slate-500 hover:underline"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-rose-600 text-xs">{error}</p>}
      {ok && <p className="text-emerald-600 text-xs">Contraseña actualizada.</p>}
    </div>
  )
}
