'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
export default function EmpleadoForm() {
  const [nombreApellido, setNombreApellido] = useState('')
  const [cuil, setCuil] = useState('')
  const [legajo, setLegajo] = useState('')
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [horasContrato, setHorasContrato] = useState('8')
  const [empresa, setEmpresa] = useState('DINAMIC')
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
      legajo: legajo,
      fecha_ingreso: fechaIngreso || null,
      horas_contrato: parseInt(horasContrato),
      empresa: empresa,
    })
    setLoading(false)
    if (error) {
      setError('Error al guardar: ' + error.message)
      return
    }
    setNombreApellido('')
    setCuil('')
    setLegajo('')
    setFechaIngreso('')
    setHorasContrato('8')
    setEmpresa('DINAMIC')
    router.refresh()
  }
  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      <input type="text" placeholder="Nombre y apellido" value={nombreApellido} onChange={(e) => setNombreApellido(e.target.value)} required className={`flex-1 min-w-[180px] ${inputStyle}`} />
      <input type="text" placeholder="CUIL" value={cuil} onChange={(e) => setCuil(e.target.value)} required className={`w-40 ${inputStyle}`} />
      <input type="text" placeholder="Legajo" value={legajo} onChange={(e) => setLegajo(e.target.value)} className={`w-28 ${inputStyle}`} />
      <input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} className={`w-44 ${inputStyle}`} />
      <select value={horasContrato} onChange={(e) => setHorasContrato(e.target.value)} className={`w-28 ${inputStyle}`}>
        <option value="4">4 hs</option>
        <option value="6">6 hs</option>
        <option value="8">8 hs</option>
        <option value="1">4+4 hs</option>
      </select>
      <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={`w-32 ${inputStyle}`}>
        <option value="DINAMIC">Dinamic</option>
        <option value="MORAL">Moral</option>
      </select>
      <button type="submit" disabled={loading} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
        {loading ? 'Guardando...' : 'Agregar'}
      </button>
      {error && <p className="text-rose-600 text-sm w-full">{error}</p>}
    </form>
  )
}