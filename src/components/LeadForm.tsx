'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import BuscadorProspecto from './BuscadorProspecto'
import ProspectoForm from './ProspectoForm'
import type { CatalogoItem, PerfilResumen } from '@/types/crm'

type Prospecto = { id: string; nombre: string }

const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

// Mismo patrón que OportunidadForm.tsx: elegir un prospecto existente o
// crear uno nuevo al vuelo, responsable fijo para cualquiera que no sea
// admin (ver src/app/ventas/leads/nuevo/page.tsx).
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
  // Solo se usa cuando responsableFijo es null (admin): puede asignarle el
  // lead a cualquier vendedor del equipo, igual que en OportunidadForm.tsx.
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
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      setError('No se pudo identificar al usuario logueado.')
      return
    }
    const { data, error: errInsert } = await supabase
      .from('crm_leads')
      .insert({
        prospecto_id: prospecto.id,
        responsable_id: responsableId,
        proxima_fecha_contacto: proximaFechaContacto || null,
        notas: notas || null,
      })
      .select('id')
      .single()
    if (errInsert || !data) {
      setLoading(false)
      setError('Error al guardar: ' + (errInsert?.message ?? 'desconocido'))
      return
    }

    // Deja registro en el historial, mismo criterio que el alta de
    // oportunidad: si esto falla no se avisa ni se revierte nada, el lead ya
    // se guardó bien, que es lo importante.
    await supabase.from('crm_seguimientos_leads').insert({
      lead_id: data.id,
      nota: 'Lead creado.',
      usuario_id: user.id,
    })

    setLoading(false)
    router.push(`/ventas/leads/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Prospecto (potencial cliente)</label>
        {prospecto ? (
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            <span className="text-sm text-slate-800 font-medium flex-1">{prospecto.nombre}</span>
            <button
              type="button"
              onClick={() => setProspecto(null)}
              className="text-rose-600 hover:underline text-sm"
            >
              Quitar
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setModoProspecto('buscar')}
                className={`px-3 py-1.5 text-sm rounded-lg ${modoProspecto === 'buscar' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Buscar existente
              </button>
              <button
                type="button"
                onClick={() => setModoProspecto('crear')}
                className={`px-3 py-1.5 text-sm rounded-lg ${modoProspecto === 'crear' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Crear prospecto nuevo
              </button>
            </div>
            {modoProspecto === 'buscar' ? (
              <BuscadorProspecto prospectos={prospectos} onSeleccionar={setProspecto} />
            ) : (
              <ProspectoForm
                tiposCliente={tiposCliente}
                referidores={referidores}
                onCreated={setProspecto}
              />
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-start">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Próximo contacto (opcional)</label>
          <input type="date" value={proximaFechaContacto} onChange={(e) => setProximaFechaContacto(e.target.value)} className={inputStyle} />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Responsable</label>
          {responsableFijo ? (
            <p className={`w-48 ${inputStyle} bg-slate-50 text-slate-600 flex items-center`}>{responsableFijo.nombre_completo}</p>
          ) : (
            <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} required className={`w-48 ${inputStyle}`}>
              <option value="">Elegir responsable</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre_completo}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <textarea
        placeholder="Notas (opcional): cómo surgió, qué le interesaría, etc."
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={3}
        className={`w-full ${inputStyle}`}
      />

      {error && <p className="text-rose-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="self-start px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Crear lead'}
      </button>
    </form>
  )
}
