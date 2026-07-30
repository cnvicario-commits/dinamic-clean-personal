'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function CerrarAsignacionBoton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleClick = async () => {
    const hoy = new Date().toISOString().split('T')[0]
    setLoading(true)
    await supabase.from('asignaciones').update({ fecha_hasta: hoy }).eq('id', id)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
    >
      {loading ? '...' : 'Finalizar'}
    </button>
  )
}