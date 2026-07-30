'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type Empleado = { id: string; nombre_apellido: string }

export default function AusenciaForm({ empleados }: { empleados: Empleado[] }) {
  const [empleadoId, setEmpleadoId] = useState('')
  const [fecha, setFecha] = useState('')
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
    setFecha('')
    setJustificada('true')
    setObservaciones('')
    setArchivo(null)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
      <select value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} required style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
        <option value="">Seleccionar empleado</option>
        {empleados.map((emp) => (
          <option key={emp.id} value={emp.id}>{emp.nombre_apellido}</option>
        ))}
      </select>

      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />

      <select value={justificada} onChange={(e) => setJustificada(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}>
        <option value="true">Justificada</option>
        <option value="false">Injustificada</option>
      </select>

      <textarea placeholder="Observaciones (opcional)" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />

      <label style={{ fontSize: '0.9rem' }}>Justificación (opcional, foto o PDF)</label>
      <input type="file" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />

      <button type="submit" disabled={loading} style={{ padding: '0.6rem 1rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        {loading ? 'Guardando...' : 'Registrar ausencia'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  )
}