'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export default function ArticuloEstadoBoton({ id, activo }: { id: string; activo: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    setError('')
    try {
      await (await createAuthenticatedBrowserApiClient()).updateArticleStatus(id, !activo)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
          activo
            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        }`}
      >
        {loading ? '...' : activo ? 'Dar de baja' : 'Reactivar'}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
