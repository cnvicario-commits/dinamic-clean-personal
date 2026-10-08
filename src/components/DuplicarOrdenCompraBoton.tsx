'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export default function DuplicarOrdenCompraBoton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function duplicate() {
    setLoading(true)
    try {
      const row = await (await createAuthenticatedBrowserApiClient()).duplicatePurchaseOrder(id)
      router.push(`/ordenes-compra/${row.id}`)
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
      className="print:hidden px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? 'Duplicando...' : 'Duplicar'}
    </button>
  )
}
