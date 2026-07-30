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
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      <input type="text" placeholder="Nombre y apellido" value={nombreApellido} onChange={(e) => setNombreApellido(e.target.value)} required className="flex-1 min-w-[180px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
      <input type="text" placeholder="CUIL" value={cuil} onChange={(e) => setCuil(e.target.value)} required className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
      <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} className="w-44 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
      <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
        {loading ? 'Guardando...' : 'Agregar'}
      </button>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </form>
  )
}