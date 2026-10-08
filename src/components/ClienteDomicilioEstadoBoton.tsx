'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export default function ClienteDomicilioEstadoBoton({ id, clienteId, activo }: { id: string; clienteId:string; activo: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    try {
      const api=await createAuthenticatedBrowserApiClient()
      await api.updateClientAddressStatus(clienteId,id,!activo)
      router.refresh()
    } catch (cause) {
      alert('Error al actualizar el domicilio: '+(cause instanceof Error?cause.message:'desconocido'))
    } finally {
      setLoading(false)
    }
  }

  return (
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
  )
}
