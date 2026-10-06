'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export default function DuplicarPedidoCompraBoton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function duplicate() {
    setLoading(true)
    try {
      const row = await (await createAuthenticatedBrowserApiClient()).duplicatePurchaseRequest(id)
      router.push(`/pedidos-compra/${row.id}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al duplicar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={duplicate}
      disabled={loading}
      className="text-teal-600 hover:underline text-sm disabled:opacity-50"
    >
      {loading ? 'Duplicando...' : 'Duplicar'}
    </button>
  )
}
