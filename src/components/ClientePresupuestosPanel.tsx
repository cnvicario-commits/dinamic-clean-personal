'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'

export type ClientePresupuesto = {
  id: string
  nombre_archivo: string
  created_at: string
  subido_por_nombre?: string | null
}

const TAMANIO_MAXIMO = 15 * 1024 * 1024 // 15 MB

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-AR')
}

export default function ClientePresupuestosPanel({
  clienteId,
  presupuestos,
}: {
  clienteId: string
  presupuestos: ClientePresupuesto[]
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [verificandoId, setVerificandoId] = useState<string | null>(null)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  const router = useRouter()

  async function subir() {
    setError('')
    if (!archivo) {
      setError('Elegí un archivo PDF primero.')
      return
    }
    if (archivo.type !== 'application/pdf' && !archivo.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se aceptan archivos PDF.')
      return
    }
    if (archivo.size > TAMANIO_MAXIMO) {
      setError('El archivo no puede pesar más de 15 MB.')
      return
    }

    setSubiendo(true)
    try {
      const bytes=new Uint8Array(await archivo.arrayBuffer())
      let binary=''; for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000))
      const api=await createAuthenticatedBrowserApiClient()
      await api.uploadClientQuote(clienteId,{fileName:archivo.name,contentBase64:btoa(binary)})
    } catch(cause) {
      setError('Error al subir el archivo: '+(cause instanceof Error?cause.message:'desconocido'))
      setSubiendo(false)
      return
    }

    setArchivo(null)
    setSubiendo(false)
    router.refresh()
  }

  async function ver(p: ClientePresupuesto) {
    setVerificandoId(p.id)
    try { const api=await createAuthenticatedBrowserApiClient(); const data=await api.getClientQuoteDownload(clienteId,p.id); window.open(data.url,'_blank','noopener,noreferrer') }
    catch(cause){alert('Error al abrir el archivo: '+(cause instanceof Error?cause.message:'desconocido'))}
    setVerificandoId(null)
  }

  async function eliminar(p: ClientePresupuesto) {
    if (!confirm(`¿Eliminar "${p.nombre_archivo}"? No se puede deshacer.`)) return
    setEliminandoId(p.id)
    let errDelete:Error|null=null
    try { const api=await createAuthenticatedBrowserApiClient(); await api.deleteClientQuote(clienteId,p.id) } catch(cause){errDelete=cause instanceof Error?cause:new Error('desconocido')}
    setEliminandoId(null)
    if (errDelete) {
      alert('Error al eliminar: ' + errDelete.message)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setArchivo(e.target.files?.[0] || null)}
          className="text-sm text-slate-700"
        />
        <button
          type="button"
          onClick={subir}
          disabled={subiendo || !archivo}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {subiendo ? 'Subiendo...' : 'Subir presupuesto'}
        </button>
      </div>
      {error && <p className="text-rose-600 text-sm mb-3">{error}</p>}

      {presupuestos.length === 0 ? (
        <p className="text-slate-500 text-sm">Todavía no hay presupuestos adjuntos.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {presupuestos.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
              <div>
                <p className="text-sm text-slate-800">{p.nombre_archivo}</p>
                <p className="text-xs text-slate-400">
                  Subido el {formatearFecha(p.created_at)}
                  {p.subido_por_nombre ? ` por ${p.subido_por_nombre}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => ver(p)}
                  disabled={verificandoId === p.id}
                  className="text-sm text-teal-600 hover:underline disabled:opacity-50"
                >
                  {verificandoId === p.id ? 'Abriendo...' : 'Ver'}
                </button>
                <button
                  type="button"
                  onClick={() => eliminar(p)}
                  disabled={eliminandoId === p.id}
                  className="text-sm text-rose-600 hover:underline disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
