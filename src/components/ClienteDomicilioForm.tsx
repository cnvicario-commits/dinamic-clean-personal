'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import type { ClienteDomicilio } from '@/types/compras'

export default function ClienteDomicilioForm({
  clienteId,
  domicilio,
  onGuardado,
}: {
  clienteId: string
  domicilio?: ClienteDomicilio
  onGuardado?: () => void
}) {
  const [alias, setAlias] = useState(domicilio?.alias ?? '')
  const [direccion, setDireccion] = useState(domicilio?.direccion ?? '')
  const [esPrincipal, setEsPrincipal] = useState(domicilio?.es_principal ?? false)
  const [horarioAtencion, setHorarioAtencion] = useState(domicilio?.horario_atencion ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const api = await createAuthenticatedBrowserApiClient()
      const payload = {
        alias,
        direccion: direccion || null,
        esPrincipal,
        horarioAtencion: horarioAtencion || null,
      }
      if (domicilio) await api.updateClientAddress(clienteId, domicilio.id, payload)
      else await api.createClientAddress(clienteId, payload)
    } catch (cause) {
      setLoading(false)
      setError('Error al guardar: ' + (cause instanceof Error ? cause.message : 'desconocido'))
      return
    }
    setLoading(false)
    if (domicilio) {
      onGuardado?.()
    } else {
      setAlias('')
      setDireccion('')
      setEsPrincipal(false)
      setHorarioAtencion('')
    }
    router.refresh()
  }

  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      <input type="text" placeholder="Alias (ej: Planta Norte)" value={alias} onChange={(e) => setAlias(e.target.value)} required className={`w-52 ${inputStyle}`} />
      <input type="text" placeholder="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} required className={`flex-1 min-w-[220px] ${inputStyle}`} />
      <input type="text" placeholder="Horario de atención (opcional)" value={horarioAtencion} onChange={(e) => setHorarioAtencion(e.target.value)} className={`flex-1 min-w-[200px] ${inputStyle}`} />
      <label className="flex items-center gap-2 text-sm text-slate-600 px-3 py-2">
        <input type="checkbox" checked={esPrincipal} onChange={(e) => setEsPrincipal(e.target.checked)} />
        Es principal
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : domicilio ? 'Guardar cambios' : 'Agregar domicilio'}
        </button>
        {domicilio && (
          <button type="button" onClick={() => onGuardado?.()} className="px-4 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </form>
  )
}
