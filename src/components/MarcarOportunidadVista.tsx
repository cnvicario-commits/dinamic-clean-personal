'use client'
import { useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

// Componente invisible: al entrar a la ficha, marca la oportunidad como
// "vista ahora" por el usuario actual. Es lo que usa src/utils/novedades.ts
// para dejar de mostrarla como pendiente en el Kanban y en el panel de
// Novedades. No se avisa si falla (no es una acción que el usuario disparó).
export default function MarcarOportunidadVista({ oportunidadId }: { oportunidadId: string }) {
  useEffect(() => {
    let cancelado = false
    async function marcar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelado) return
      await supabase.from('crm_vistas').upsert(
        { oportunidad_id: oportunidadId, usuario_id: user.id, last_viewed_at: new Date().toISOString() },
        { onConflict: 'oportunidad_id,usuario_id' }
      )
    }
    marcar()
    return () => {
      cancelado = true
    }
  }, [oportunidadId])

  return null
}
