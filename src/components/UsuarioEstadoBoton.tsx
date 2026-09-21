'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function UsuarioEstadoBoton({
  perfilId,
  disabled,
}: {
  perfilId: string
  disabled: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    setError('')
    setLoading(true)
    try {
      const action = disabled ? 'enable' : 'disable'
      const res = await fetch(`/api/usuarios/${perfilId}/${action}`, { method: 'POST' })
      if (res.status === 401) {
        const data = (await res.json().catch(() => null)) as { code?: string; error?: string } | null
        if (data?.code === 'user_disabled') {
          window.location.href = '/login'
          return
        }
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error ?? 'No se pudo actualizar el estado.')
        return
      }
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`text-xs font-medium hover:underline disabled:opacity-50 ${
          disabled ? 'text-emerald-700' : 'text-rose-600'
        }`}
      >
        {loading ? '…' : disabled ? 'Habilitar' : 'Deshabilitar'}
      </button>
      {error ? <p className="text-rose-600 text-xs">{error}</p> : null}
    </div>
  )
}
