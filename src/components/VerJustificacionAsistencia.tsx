'use client'
import { useState } from 'react'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export default function VerJustificacionAsistencia({ attendanceId }: { attendanceId: string }) {
  const [loading, setLoading] = useState(false)

  async function ver() {
    setLoading(true)
    try {
      const api = await createAuthenticatedBrowserApiClient()
      const data = await api.getAttendanceJustificationDownload(attendanceId)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      alert('Error al abrir el archivo: ' + (cause instanceof Error ? cause.message : 'desconocido'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={ver}
      disabled={loading}
      className="text-teal-600 hover:underline disabled:opacity-50"
    >
      {loading ? 'Abriendo...' : 'Ver'}
    </button>
  )
}
