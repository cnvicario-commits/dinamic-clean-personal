'use client'
import { useEffect } from 'react'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

// Componente invisible: al entrar a la ficha, marca la oportunidad como
// "vista ahora" por el usuario actual. Es lo que usa src/utils/novedades.ts
// para dejar de mostrarla como pendiente en el Kanban y en el panel de
// Novedades. No se avisa si falla (no es una acción que el usuario disparó).
export default function MarcarOportunidadVista({ oportunidadId }: { oportunidadId: string }) {
  useEffect(() => {
    let cancelado = false
    async function marcar() {
      if (cancelado) return
      try { const api=await createAuthenticatedBrowserApiClient(); if(!cancelado) await api.markCrmOpportunityViewed(oportunidadId) } catch { /* non-blocking */ }
    }
    marcar()
    return () => {
      cancelado = true
    }
  }, [oportunidadId])

  return null
}
