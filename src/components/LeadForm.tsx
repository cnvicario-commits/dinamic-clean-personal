'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import BuscadorProspecto from './BuscadorProspecto'
import ProspectoForm from './ProspectoForm'
import type { CatalogoItem, PerfilResumen } from '@/types/crm'

type Prospecto = { id: string; nombre: string }
const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

export default function LeadForm({
  prospectos,
  tiposCliente,
  referidores,
  responsables,
  responsableFijo = null,
}: {
  prospectos: Prospecto[]
  tiposCliente: CatalogoItem[]
  referidores: CatalogoItem[]
  responsables: PerfilResumen[]
  responsableFijo?: PerfilResumen | null
}) {
  const [modoProspecto, setModoProspecto] = useState<'buscar' | 'crear'>('buscar')
  const [prospecto, setProspecto] = useState<Prospecto | null>(null)
  const [responsableId, setResponsableId] = useState(responsableFijo?.id ?? '')
  const [proximaFechaContacto, setProximaFechaContacto] = useState('')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!prospecto) {
      setError('Elegí un prospecto existente o creá uno nuevo.')
      return
    }
    if (!responsableId) {
      setError('Elegí un responsable.')
      return
    }
    setLoading(true)
    try {
      const api = await createAuthenticatedBrowserApiClient()
      const result = await api.createCrmLead(
        {
          prospectoId: prospecto.id,
          responsableId,
          proximaFechaContacto: proximaFechaContacto || null,
          notas: notas || null,
        },
        crypto.randomUUID(),
      )
      router.push(`/ventas/leads/${result.response.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el lead')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Prospecto</label>
        {prospecto ? (
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-800 font-medium flex-1">{prospecto.nombre}</span>
            <button type="button" onClick={() => setProspecto(null)} className="text-rose-600 text-sm">Quitar</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => setModoProspecto('buscar')} className={`px-3 py-1.5 text-sm rounded-lg ${modoProspecto === 'buscar' ? 'bg-teal-600 text-white' : 'bg-slate-100'}`}>Buscar existente</button>
              <button type="button" onClick={() => setModoProspecto('crear')} className={`px-3 py-1.5 text-sm rounded-lg ${modoProspecto === 'crear' ? 'bg-teal-600 text-white' : 'bg-slate-100'}`}>Crear prospecto nuevo</button>
            </div>
            {modoProspecto === 'buscar' ? (
              <BuscadorProspecto prospectos={prospectos} onSeleccionar={setProspecto} />
            ) : (
              <ProspectoForm tiposCliente={tiposCliente} referidores={referidores} onCreated={setProspecto} />
            )}
          </>
        )}
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Responsable</label>
        {responsableFijo ? (
          <p className={`${inputStyle} bg-slate-50`}>{responsableFijo.nombre_completo}</p>
        ) : (
          <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} required className={inputStyle}>
            <option value="">Elegir responsable</option>
            {responsables.map((responsable) => <option key={responsable.id} value={responsable.id}>{responsable.nombre_completo}</option>)}
          </select>
        )}
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-slate-500 mb-1">Próximo contacto</label>
        <input type="date" value={proximaFechaContacto} onChange={(e) => setProximaFechaContacto(e.target.value)} className={inputStyle} />
      </div>
      <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} placeholder="Notas" className={inputStyle} />
      {error && <p className="text-rose-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="self-start px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
        {loading ? 'Guardando...' : 'Crear lead'}
      </button>
    </form>
  )
}
