'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function MarcarPrincipalBoton({ id, clienteId }: { id: string; clienteId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleClick = async () => {
    setLoading(true)
    // Primero se desmarcan todos los del cliente, después se marca este:
    // así nunca queda más de uno como principal a la vez.
    await supabase.from('cliente_domicilios').update({ es_principal: false }).eq('cliente_id', clienteId)
    await supabase.from('cliente_domicilios').update({ es_principal: true }).eq('id', id)
    setLoading(false)
    router.refresh()
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
