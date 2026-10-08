'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

const TIPOS = ['Llamada', 'Email', 'WhatsApp', 'Reunión', 'Otro']
const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm'

export default function RegistrarSeguimientoLeadForm({ leadId }: { leadId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [fechaContacto, setFechaContacto] = useState(() => new Date().toISOString().slice(0, 10))
  const [tipoContacto, setTipoContacto] = useState(TIPOS[0] ?? 'Llamada')
  const [nota, setNota] = useState('')
  const [proximaFecha, setProximaFecha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!nota.trim()) {
      setError('Escribí una nota sobre el contacto.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const api = await createAuthenticatedBrowserApiClient()
      await api.createCrmLeadFollowUp(leadId, {
        fechaContacto,
        tipoContacto,
        nota: nota.trim(),
        proximaFechaContacto: proximaFecha || null,
      })
      setNota('')
      setProximaFecha('')
      setAbierto(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar')
    } finally {
      setLoading(false)
    }
  }

  if (!abierto) {
    return <button type="button" onClick={() => setAbierto(true)} className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg">Registrar seguimiento</button>
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input type="date" value={fechaContacto} onChange={(e) => setFechaContacto(e.target.value)} required className={inputStyle} />
        <select value={tipoContacto} onChange={(e) => setTipoContacto(e.target.value)} className={inputStyle}>
          {TIPOS.map((tipo) => <option key={tipo}>{tipo}</option>)}
        </select>
        <input type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} className={inputStyle} />
      </div>
      <textarea value={nota} onChange={(e) => setNota(e.target.value)} required rows={2} placeholder="Nota sobre el contacto" className={inputStyle} />
      {error && <p className="text-rose-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-slate-500">Cancelar</button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar seguimiento'}</button>
      </div>
    </form>
  )
}
