'use client'
import { useState, useRef, useEffect } from 'react'

type Articulo = { id: string; codigo_interno: string; nombre: string }

export default function BuscadorArticulo({
  articulos,
  onSeleccionar,
  placeholder = 'Buscar artículo por nombre o código...',
}: {
  articulos: Articulo[]
  onSeleccionar: (articulo: Articulo) => void
  placeholder?: string
}) {
  const [busqueda, setBusqueda] = useState('')
  const [articuloId, setArticuloId] = useState('')
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
    ? articulos
    : articulos.filter(
        (a) =>
          a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          a.codigo_interno.toLowerCase().includes(busqueda.toLowerCase())
      )

  function seleccionar(a: Articulo) {
    setArticuloId(a.id)
    setBusqueda(`${a.codigo_interno} — ${a.nombre}`)
    setMostrarLista(false)
    onSeleccionar(a)
  }

  function limpiar() {
    setArticuloId('')
    setBusqueda('')
  }

  const inputStyle = "px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 w-full"

  return (
    <div ref={contenedorRef} className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setArticuloId('')
            setMostrarLista(true)
          }}
          onFocus={() => setMostrarLista(true)}
          className={inputStyle}
          autoComplete="off"
        />
        {articuloId && (
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
            filtrados.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => seleccionar(a)}
                className="w-full text-left px-3 py-3 text-sm text-slate-800 hover:bg-teal-50 active:bg-teal-100 border-b border-slate-100 last:border-0"
              >
                {a.codigo_interno} — {a.nombre}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
