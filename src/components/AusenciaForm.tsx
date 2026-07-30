'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Empleado = { id: string; nombre_apellido: string }

function fechaHoy() {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export default function AusenciaForm({ empleados }: { empleados: Empleado[] }) {
  const [empleadoId, setEmpleadoId] = useState('')
  const [fecha, setFecha] = useState(fechaHoy())
  const [justificada, setJustificada] = useState('true')
  const [observaciones, setObservaciones] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    let archivoUrl: string | null = null

    if (archivo) {
      const nombreArchivo = `${empleadoId}_${Date.now()}_${archivo.name}`
      const { error: uploadError } = await supabase.storage
        .from('justificaciones')
        .upload(nombreArchivo, archivo)

      if (uploadError) {
        setError('Error al subir archivo: ' + uploadError.message)
        setLoading(false)
        return
      }

      const { data: signedData } = await supabase.storage
        .from('justificaciones')
        .createSignedUrl(nombreArchivo, 60 * 60 * 24 * 365)

      archivoUrl = signedData?.signedUrl || null
    }

    const { data: userData } = await supabase.auth.getUser()

    const { error: insertError } = await supabase.from('ausencias').insert({
      empleado_id: empleadoId,
      fecha: fecha,
      justificada: justificada === 'true',
      observaciones: observaciones,
      archivo_url: archivoUrl,
      informado_por: userData.user?.id,
    })

    setLoading(false)

    if (insertError) {
      setError('Error al guardar: ' + insertError.message)
      return
    }

    setEmpleadoId('')
    setFecha(fechaHoy())
    setJustificada('true')
    setObservaciones('')
    setArchivo(null)
    router.refresh()
  }

  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} required className={inputStyle}>
        <option value="">Seleccionar empleado</option>
        {empleados.map((emp) => (
          <option key={emp.id} value={emp.id}>{emp.nombre_apellido}</option>
        ))}
      </select>

      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className={inputStyle} />

      <select value={justificada} onChange={(e) => setJustificada(e.target.value)} className={inputStyle}>
        <option value="true">Justificada</option>
        <option value="false">Injustificada</option>
      </select>

      <textarea placeholder="Observaciones (opcional)" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={`${inputStyle} placeholder:text-slate-400`} />

      <div>
        <label className="text-sm text-slate-700 block mb-1">Justificación (opcional, foto o PDF)</label>
        <input type="file" onChange={(e) => setArchivo(e.target.files?.[0] || null)} className="text-sm text-slate-700" />
      </div>

      <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 self-start">
        {loading ? 'Guardando...' : 'Registrar ausencia'}
      </button>

      {error && <p className="text-rose-600 text-sm">{error}</p>}
    </form>
  )
}