'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export default function MarcarPrincipalBoton({ id, clienteId }: { id: string; clienteId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    try {
      const api=await createAuthenticatedBrowserApiClient()
      await api.setClientAddressPrincipal(clienteId,id)
      router.refresh()
    } catch (cause) {
      alert('Error al establecer el domicilio principal: '+(cause instanceof Error?cause.message:'desconocido'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-teal-600 hover:underline text-sm disabled:opacity-50"
    >
      {loading ? 'Marcando...' : 'Marcar como principal'}
    </button>
  )
}
