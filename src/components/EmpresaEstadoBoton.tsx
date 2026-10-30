'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import { runCompanyWrite, saveCompanyStatus } from '@/lib/empresas/company-writes'

export default function EmpresaEstadoBoton({ id, activo }: { id: string; activo: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleClick = async () => {
    if (loading) return
    setError('')
    setLoading(true)
    let api
    try {
      api = await createAuthenticatedBrowserApiClient()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar la empresa.')
      setLoading(false)
      return
    }
    const result = await runCompanyWrite(() => saveCompanyStatus(api, id, !activo))
    setLoading(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    router.refresh()
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
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
      {error && <span className="text-rose-600 text-xs">{error}</span>}
    </span>
  )
}
