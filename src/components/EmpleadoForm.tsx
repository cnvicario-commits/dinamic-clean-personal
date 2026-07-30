'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function EmpleadoForm() {
  const [nombreApellido, setNombreApellido] = useState('')
  const [cuil, setCuil] = useState('')
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.from('empleados').insert({
      nombre_apellido: nombreApellido,
      cuil: cuil,
      fecha_ingreso: fechaIngreso || null,
    })

    setLoading(false)

    if (error) {
      setError('Error al guardar: ' + error.message)
      return
    }

    setNombreApellido('')
    setCuil('')
    setFechaIngreso('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      <input type="text" placeholder="Nombre y apellido" value={nombreApellido} onChange={(e) => setNombreApellido(e.target.value)} required style={{ flex: 2, minWidth: '180px', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
      <input type="text" placeholder="CUIL" value={cuil} onChange={(e) => setCuil(e.target.value)} required style={{ flex: 1, minWidth: '120px', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
      <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} style={{ flex: 1, minWidth: '140px', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }} />
      <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem', background: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        {loading ? 'Guardando...' : 'Agregar'}
      </button>
      {error && <p style={{ color: 'red', width: '100%' }}>{error}</p>}
    </form>
  )
}