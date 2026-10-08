'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES } from '@/utils/permisos'
import { PASSWORD_MIN_LENGTH } from '@/lib/password-policy'

const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

export default function UsuarioForm() {
  const [nombreCompleto, setNombreCompleto] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setOk(false)
    if (!nombreCompleto.trim() || !email.trim() || !password || !rol) {
      setError('Completá todos los campos.')
      return
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreCompleto: nombreCompleto.trim(),
          email: email.trim(),
          password,
          rol,
        }),
      })
      const data = await res.json().catch(() => ({
        error: 'El servidor no respondió correctamente. Probá de nuevo en un momento.',
      }))
      if (!res.ok) {
        setError(data.error ?? 'Error al crear el usuario.')
        return
      }
      setNombreCompleto('')
      setEmail('')
      setPassword('')
      setRol('')
      setOk(true)
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Probá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-wrap gap-2 items-start"
    >
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Nombre completo</label>
        <input
          type="text"
          value={nombreCompleto}
          onChange={(e) => setNombreCompleto(e.target.value)}
          className={`w-48 ${inputStyle}`}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`w-56 ${inputStyle}`}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Contraseña temporal</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`Al menos ${PASSWORD_MIN_LENGTH} caracteres`}
          className={`w-44 ${inputStyle}`}
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Rol</label>
        <select value={rol} onChange={(e) => setRol(e.target.value)} className={`w-40 ${inputStyle}`}>
          <option value="">Elegir rol</option>
          {ROLES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.etiqueta}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
      >
        {loading ? 'Creando...' : 'Crear usuario'}
      </button>
      {error && <p className="w-full text-rose-600 text-sm mt-1">{error}</p>}
      {ok && <p className="w-full text-emerald-600 text-sm mt-1">Usuario creado.</p>}
    </form>
  )
}
