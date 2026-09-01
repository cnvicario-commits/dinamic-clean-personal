'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export type ClientePresupuesto = {
  id: string
  nombre_archivo: string
  storage_path: string
  created_at: string
  perfiles: { nombre_completo: string } | null
}

const BUCKET = 'presupuestos-clientes'
const TAMANIO_MAXIMO = 15 * 1024 * 1024 // 15 MB

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString('es-AR')
}

// Saca tildes, espacios y caracteres raros del nombre para el path de
// storage — el nombre original (con tildes y todo) se guarda aparte en
// nombre_archivo, para mostrarlo tal cual en la pantalla.
function sanitizarNombre(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(new RegExp('[̀-ͯ]', 'g'), '') // marcas diacríticas (tildes, etc.) tras normalizar
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
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
  const supabase = createClient()

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
    const path = `${clienteId}/${crypto.randomUUID()}_${sanitizarNombre(archivo.name)}`
    const { error: errUpload } = await supabase.storage.from(BUCKET).upload(path, archivo)
    if (errUpload) {
      setError('Error al subir el archivo: ' + errUpload.message)
      setSubiendo(false)
      return
    }

    const { data: userData } = await supabase.auth.getUser()
    const { error: errInsert } = await supabase.from('cliente_presupuestos').insert({
      cliente_id: clienteId,
      storage_path: path,
      nombre_archivo: archivo.name,
      subido_por: userData.user?.id ?? null,
    })
    if (errInsert) {
      setError('El archivo se subió, pero falló guardar el registro: ' + errInsert.message)
      setSubiendo(false)
      return
    }

    setArchivo(null)
    setSubiendo(false)
    router.refresh()
  }

  async function ver(p: ClientePresupuesto) {
    setVerificandoId(p.id)
    const { data, error: errUrl } = await supabase.storage.from(BUCKET).createSignedUrl(p.storage_path, 60)
    setVerificandoId(null)
    if (errUrl || !data) {
      alert('Error al abrir el archivo: ' + errUrl?.message)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function eliminar(p: ClientePresupuesto) {
    if (!confirm(`¿Eliminar "${p.nombre_archivo}"? No se puede deshacer.`)) return
    setEliminandoId(p.id)
    await supabase.storage.from(BUCKET).remove([p.storage_path])
    const { error: errDelete } = await supabase.from('cliente_presupuestos').delete().eq('id', p.id)
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
                  {p.perfiles?.nombre_completo ? ` por ${p.perfiles.nombre_completo}` : ''}
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
