'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiClientError } from '@/lib/api/generated'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export default function CerrarAsignacionBoton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    setError('')
    try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.closeAssignment(id)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'No se pudo finalizar la asignación.')
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
      className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
    >
      {loading ? '...' : 'Finalizar'}
    </button>
    {error && <p className="text-rose-600 text-xs mt-1">{error}</p>}
  </div>
}
