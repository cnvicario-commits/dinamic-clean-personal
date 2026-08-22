'use client'
import { useState, useRef, useEffect } from 'react'

type Prospecto = { id: string; nombre: string }

// Mismo patrón que BuscadorArticulo.tsx: lista completa por props (server
// component padre ya la trajo), filtro en memoria mientras se tipea, cierre
// del dropdown al hacer click afuera.
export default function BuscadorProspecto({
  prospectos,
  onSeleccionar,
  placeholder = 'Buscar prospecto por nombre...',
}: {
  prospectos: Prospecto[]
  onSeleccionar: (prospecto: Prospecto) => void
  placeholder?: string
}) {
  const [busqueda, setBusqueda] = useState('')
  const [prospectoId, setProspectoId] = useState('')
  const [mostrarLista, setMostrarLista] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setMostrarLista(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  const filtrados = busqueda.trim() === ''
    ? prospectos
    : prospectos.filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  function seleccionar(p: Prospecto) {
    setProspectoId(p.id)
    setBusqueda(p.nombre)
    setMostrarLista(false)
    onSeleccionar(p)
  }

  function limpiar() {
    setProspectoId('')
    setBusqueda('')
  }

  const inputStyle = 'px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full'

  return (
    <div ref={contenedorRef} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setProspectoId('')
            setMostrarLista(true)
          }}
          onFocus={() => setMostrarLista(true)}
          className={inputStyle}
          autoComplete="off"
        />
        {prospectoId && (
          <button
            type="button"
            onClick={limpiar}
            className="px-3 py-2 text-sm text-slate-500 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Quitar
          </button>
        )}
      </div>
      {mostrarLista && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtrados.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400">Sin resultados</p>
          ) : (
            filtrados.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => seleccionar(p)}
                className="w-full text-left px-3 py-3 text-sm text-slate-800 hover:bg-teal-50 active:bg-teal-100 border-b border-slate-100 last:border-0"
              >
                {p.nombre}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
