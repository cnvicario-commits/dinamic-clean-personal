'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { CatalogoItem } from '@/types/crm'

const VALOR_NUEVO = '__nuevo__'

// Select poblado por props + una opción "+ Agregar nuevo..." que revela un
// mini-form para insertar en el catálogo (crm_tipos_cliente/crm_tipos_servicio/
// crm_referidores) al vuelo, sin recargar la página ni tocar código. Los
// catálogos son listas chicas, por eso alcanza un <select> en vez de un
// combobox de búsqueda (ver BuscadorProspecto.tsx para listas más grandes).
export default function SelectConCrear({
  tabla,
  items,
  value,
  onChange,
  placeholder,
  className,
}: {
  tabla: 'crm_tipos_cliente' | 'crm_tipos_servicio' | 'crm_referidores'
  items: CatalogoItem[]
  value: string
  onChange: (id: string, itemsActualizados: CatalogoItem[]) => void
  placeholder: string
  className?: string
}) {
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function crear() {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    setGuardando(true)
    setError('')
    const { data, error: errInsert } = await supabase
      .from(tabla)
      .insert({ nombre })
      .select('id, nombre')
      .single()
    setGuardando(false)
    if (errInsert || !data) {
      setError('Error al crear: ' + (errInsert?.message ?? 'desconocido'))
      return
    }
    const itemsActualizados = [...items, data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
    onChange(data.id, itemsActualizados)
    setNuevoNombre('')
    setCreando(false)
  }

  const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  if (creando) {
    return (
      <div className="flex flex-wrap gap-2 items-start">
        <input
          autoFocus
          type="text"
          placeholder={`Nuevo: ${placeholder}`}
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
          className={`flex-1 min-w-[160px] ${inputStyle}`}
        />
        <button
          type="button"
          onClick={crear}
          disabled={guardando || !nuevoNombre.trim()}
          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {guardando ? 'Creando...' : 'Crear'}
        </button>
        <button
          type="button"
          onClick={() => {
            setCreando(false)
            setNuevoNombre('')
            setError('')
          }}
          className="px-3 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Cancelar
        </button>
        {error && <p className="text-rose-600 text-xs w-full">{error}</p>}
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === VALOR_NUEVO) setCreando(true)
        else onChange(e.target.value, items)
      }}
      className={className ?? inputStyle}
    >
      <option value="">{placeholder}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>{i.nombre}</option>
      ))}
      <option value={VALOR_NUEVO}>+ Agregar nuevo...</option>
    </select>
  )
}
