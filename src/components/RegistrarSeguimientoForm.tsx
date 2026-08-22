'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const TIPOS_CONTACTO = ['Llamada', 'Email', 'WhatsApp', 'Reunión', 'Otro']

export default function RegistrarSeguimientoForm({ oportunidadId }: { oportunidadId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [fechaContacto, setFechaContacto] = useState(() => new Date().toISOString().slice(0, 10))
  const [tipoContacto, setTipoContacto] = useState(TIPOS_CONTACTO[0])
  const [nota, setNota] = useState('')
  const [proximaFecha, setProximaFecha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nota.trim()) {
      setError('Escribí una nota sobre el contacto.')
      return
    }
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    // proxima_fecha_seguimiento, si se completa, actualiza sola el campo
    // homónimo en crm_oportunidades (trigger de la migración 0018).
    const { error: errInsert } = await supabase.from('crm_seguimientos').insert({
      oportunidad_id: oportunidadId,
      fecha_contacto: fechaContacto,
      tipo_contacto: tipoContacto,
      nota: nota.trim(),
      proxima_fecha_seguimiento: proximaFecha || null,
      usuario_id: userData.user?.id,
    })
    setLoading(false)
    if (errInsert) {
      setError('Error al guardar: ' + errInsert.message)
      return
    }
    setNota('')
    setProximaFecha('')
    setAbierto(false)
    router.refresh()
  }

  const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Registrar seguimiento
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-start">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Fecha de contacto</label>
          <input type="date" value={fechaContacto} onChange={(e) => setFechaContacto(e.target.value)} required className={inputStyle} />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Tipo de contacto</label>
          <select value={tipoContacto} onChange={(e) => setTipoContacto(e.target.value)} className={`w-40 ${inputStyle}`}>
            {TIPOS_CONTACTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500 mb-1">Próxima fecha de seguimiento (opcional)</label>
          <input type="date" value={proximaFecha} onChange={(e) => setProximaFecha(e.target.value)} className={inputStyle} />
        </div>
      </div>
      <textarea
        placeholder="Nota sobre el contacto"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={3}
        required
        className={inputStyle}
      />
      {error && <p className="text-rose-600 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar seguimiento'}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="px-4 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
