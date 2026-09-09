'use client'
import { useState, useRef, useEffect } from 'react'

type Cliente = { id: string; nombre: string }

// Mismo patrón que BuscadorProspecto.tsx / BuscadorArticulo.tsx: lista
// completa por props (el server component padre ya la trajo), filtro en
// memoria mientras se tipea, cierre del dropdown al hacer click afuera.
export default function BuscadorCliente({
  clientes,
  onSeleccionar,
  placeholder = 'Buscar cliente por nombre...',
  clienteInicial,
}: {
  clientes: Cliente[]
  onSeleccionar: (cliente: Cliente) => void
  placeholder?: string
  // Para pantallas de edición (ej. editar una planificación ya cargada):
  // precarga el cliente ya elegido sin que el usuario tenga que volver a
  // buscarlo. Solo se usa como valor inicial (no se sincroniza si cambia
  // después del primer render).
  clienteInicial?: Cliente
}) {
  const [busqueda, setBusqueda] = useState(clienteInicial?.nombre ?? '')
  const [clienteId, setClienteId] = useState(clienteInicial?.id ?? '')
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
    ? clientes
    : clientes.filter((c) => c.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  function seleccionar(c: Cliente) {
    setClienteId(c.id)
    setBusqueda(c.nombre)
    setMostrarLista(false)
    onSeleccionar(c)
  }

  function limpiar() {
    setClienteId('')
    setBusqueda('')
    onSeleccionar({ id: '', nombre: '' })
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
            setClienteId('')
            setMostrarLista(true)
          }}
          onFocus={() => setMostrarLista(true)}
          className={inputStyle}
          autoComplete="off"
        />
        {clienteId && (
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
            filtrados.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => seleccionar(c)}
                className="w-full text-left px-3 py-3 text-sm text-slate-800 hover:bg-teal-50 active:bg-teal-100 border-b border-slate-100 last:border-0"
              >
                {c.nombre}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
