'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiClientError } from '@/lib/api/generated'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export default function EmpleadoEstadoBoton({ id, activo }: { id: string; activo: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    setError('')
    try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.updateEmployeeStatus(id, { activo: !activo })
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'No se pudo actualizar el estado.')
      setLoading(false)
      return
    }
    setLoading(false)
    router.refresh()
  }

  return <div>
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
    {error && <p className="text-rose-600 text-xs mt-1">{error}</p>}
  </div>
}
