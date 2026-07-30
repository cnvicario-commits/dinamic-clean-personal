'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function EmpleadoEstadoBoton({ id, activo }: { id: string; activo: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleClick = async () => {
    setLoading(true)
    await supabase.from('empleados').update({ activo: !activo }).eq('id', id)
    setLoading(false)
    router.refresh()
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