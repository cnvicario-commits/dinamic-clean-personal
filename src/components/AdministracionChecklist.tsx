'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import type { ChecklistPlantilla, ChecklistItem } from '@/types/auditoria'

function formatearFecha(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

// Ítem en edición: puede ser uno ya guardado (tiene id real) o uno nuevo
// agregado en esta sesión de edición (sin id todavía, se genera al guardar).
type ItemEdicion = { id: string | null; texto: string; eliminado: boolean }

const inputStyle = 'w-full px-2 py-1 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

export default function AdministracionChecklist({
  plantillas,
  plantillaSeleccionada,
  items,
}: {
  plantillas: ChecklistPlantilla[]
  plantillaSeleccionada: ChecklistPlantilla | null
  items: ChecklistItem[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [itemsEdicion, setItemsEdicion] = useState<ItemEdicion[]>(
    items.map((it) => ({ id: it.id, texto: it.texto, eliminado: false }))
  )
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [activando, setActivando] = useState(false)

  const [creandoVersion, setCreandoVersion] = useState(false)
  const [nuevaVersion, setNuevaVersion] = useState('')
  const [nuevaVigencia, setNuevaVigencia] = useState('')
  const [creando, setCreando] = useState(false)

  // Cambiar de plantilla (o volver a cargar la seleccionada) descarta la
  // edición en curso: se resetea con la prop cuando cambia.
  const idActual = plantillaSeleccionada?.id ?? null
  const [idSincronizado, setIdSincronizado] = useState(idActual)
  if (idActual !== idSincronizado) {
    setIdSincronizado(idActual)
    setItemsEdicion(items.map((it) => ({ id: it.id, texto: it.texto, eliminado: false })))
    setError('')
    setCreandoVersion(false)
  }

  const esActiva = plantillaSeleccionada?.activa ?? false
  const itemsVisibles = itemsEdicion.filter((it) => !it.eliminado)

  function moverItem(index: number, direccion: -1 | 1) {
    setItemsEdicion((prev) => {
      const visibles = prev.filter((it) => !it.eliminado)
      const destino = index + direccion
      if (destino < 0 || destino >= visibles.length) return prev
      const copia = [...visibles]
      ;[copia[index], copia[destino]] = [copia[destino], copia[index]]
      // Reinserta los eliminados (no se muestran pero hay que conservarlos
      // para poder borrarlos al guardar).
      return [...copia, ...prev.filter((it) => it.eliminado)]
    })
  }

  function editarTexto(index: number, texto: string) {
    setItemsEdicion((prev) => {
      const visibles = prev.filter((it) => !it.eliminado)
      const eliminados = prev.filter((it) => it.eliminado)
      visibles[index] = { ...visibles[index], texto }
      return [...visibles, ...eliminados]
    })
  }

  function eliminarItem(index: number) {
    setItemsEdicion((prev) => {
      const visibles = prev.filter((it) => !it.eliminado)
      const eliminados = prev.filter((it) => it.eliminado)
      const [quitado] = visibles.splice(index, 1)
      return [...visibles, ...eliminados, { ...quitado, eliminado: true }]
    })
  }

  function agregarItem() {
    setItemsEdicion((prev) => [...prev, { id: null, texto: '', eliminado: false }])
  }

  async function guardarCambios() {
    if (!plantillaSeleccionada) return
    setError('')
    if (itemsVisibles.some((it) => !it.texto.trim())) {
      setError('Hay ítems sin texto — completalos o eliminalos antes de guardar.')
      return
    }
    setGuardando(true)

    const aBorrar = itemsEdicion.filter((it) => it.eliminado && it.id).map((it) => it.id as string)
    if (aBorrar.length) {
      const { error: errBorrar } = await supabase.from('auditoria_checklist_items').delete().in('id', aBorrar)
      if (errBorrar) {
        setError('Error al borrar ítems: ' + errBorrar.message)
        setGuardando(false)
        return
      }
    }

    const filas = itemsVisibles.map((it, i) => ({
      ...(it.id ? { id: it.id } : {}),
      plantilla_id: plantillaSeleccionada.id,
      orden: i + 1,
      texto: it.texto.trim(),
    }))
    if (filas.length) {
      const { error: errUpsert } = await supabase.from('auditoria_checklist_items').upsert(filas)
      if (errUpsert) {
        setError('Error al guardar ítems: ' + errUpsert.message)
        setGuardando(false)
        return
      }
    }

    setGuardando(false)
    router.refresh()
  }

  async function activarVersion() {
    if (!plantillaSeleccionada) return
    if (
      !confirm(
        `Vas a activar "${plantillaSeleccionada.version}". Pasa a ser la versión que se usa para las auditorías nuevas. ¿Confirmás?`
      )
    ) {
      return
    }
    setError('')
    setActivando(true)
    const { error: errActivar } = await supabase
      .from('auditoria_checklist_plantillas')
      .update({ activa: true })
      .eq('id', plantillaSeleccionada.id)
    if (errActivar) {
      setError('Error al activar: ' + errActivar.message)
      setActivando(false)
      return
    }
    setActivando(false)
    router.refresh()
  }

  async function crearNuevaVersion() {
    if (!plantillaSeleccionada) return
    if (!nuevaVersion.trim() || !nuevaVigencia) {
      setError('Completá la versión y la fecha de vigencia de la nueva versión.')
      return
    }
    setError('')
    setCreando(true)

    const { data: nueva, error: errNueva } = await supabase
      .from('auditoria_checklist_plantillas')
      .insert({
        codigo_formulario: plantillaSeleccionada.codigo_formulario,
        version: nuevaVersion.trim(),
        vigencia_desde: nuevaVigencia,
        activa: false,
      })
      .select('id')
      .single()
    if (errNueva || !nueva) {
      setError('Error al crear la versión: ' + errNueva?.message)
      setCreando(false)
      return
    }

    const itemsNuevos = itemsVisibles.map((it, i) => ({
      plantilla_id: nueva.id,
      orden: i + 1,
      texto: it.texto,
    }))
    if (itemsNuevos.length) {
      const { error: errItems } = await supabase.from('auditoria_checklist_items').insert(itemsNuevos)
      if (errItems) {
        setError('Se creó la versión, pero falló copiar los ítems: ' + errItems.message)
        setCreando(false)
        return
      }
    }

    setCreando(false)
    router.push(`/auditorias/checklist?plantilla=${nueva.id}`)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Versiones</h2>
        <div className="flex flex-col gap-1">
          {plantillas.map((p) => (
            <Link
              key={p.id}
              href={`/auditorias/checklist?plantilla=${p.id}`}
              className={`block px-3 py-2 rounded-md text-sm border ${
                p.id === plantillaSeleccionada?.id
                  ? 'border-teal-500 bg-teal-50 text-teal-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.version}</span>
                {p.activa && (
                  <span className="text-xs bg-teal-600 text-white px-1.5 py-0.5 rounded">Activa</span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {p.codigo_formulario} · vigente desde {formatearFecha(p.vigencia_desde)}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        {!plantillaSeleccionada ? (
          <p className="text-slate-500 text-sm">No hay ninguna versión del checklist cargada.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Ítems ({itemsVisibles.length})
              </h2>
              {!esActiva && (
                <button
                  type="button"
                  onClick={activarVersion}
                  disabled={activando}
                  className="text-sm text-teal-600 font-medium hover:underline disabled:opacity-50"
                >
                  {activando ? 'Activando...' : 'Activar esta versión'}
                </button>
              )}
            </div>

            {error && <p className="text-rose-600 text-sm mb-3">{error}</p>}

            {esActiva && (
              <p className="text-xs text-slate-500 mb-3">
                Esta es la versión activa — no se edita directamente (cambiaría el checklist de auditorías ya
                cargadas). Para modificarla, creá una versión nueva a partir de esta.
              </p>
            )}

            <div className="flex flex-col gap-2 mb-4">
              {itemsVisibles.map((it, i) => (
                <div key={it.id ?? `nuevo-${i}`} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                  <span className="text-xs text-slate-400 w-5 text-right shrink-0">{i + 1}</span>
                  {esActiva ? (
                    <p className="flex-1 text-sm text-slate-800">{it.texto}</p>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={it.texto}
                        onChange={(e) => editarTexto(i, e.target.value)}
                        className={`flex-1 ${inputStyle}`}
                      />
                      <button type="button" onClick={() => moverItem(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1">
                        ▲
                      </button>
                      <button type="button" onClick={() => moverItem(i, 1)} disabled={i === itemsVisibles.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1">
                        ▼
                      </button>
                      <button type="button" onClick={() => eliminarItem(i)} className="text-rose-500 hover:text-rose-700 text-xs px-1">
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {!esActiva && (
              <div className="flex items-center gap-3 mb-8">
                <button type="button" onClick={agregarItem} className="text-sm text-teal-600 hover:underline">
                  + Agregar ítem
                </button>
                <button
                  type="button"
                  onClick={guardarCambios}
                  disabled={guardando}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}

            {esActiva && (
              <div className="border-t border-slate-200 pt-4">
                {!creandoVersion ? (
                  <button type="button" onClick={() => setCreandoVersion(true)} className="text-sm text-teal-600 hover:underline">
                    + Crear nueva versión a partir de esta
                  </button>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Nueva versión (ej: REV-02)</p>
                      <input type="text" value={nuevaVersion} onChange={(e) => setNuevaVersion(e.target.value)} className={inputStyle} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Vigente desde</p>
                      <input type="date" value={nuevaVigencia} onChange={(e) => setNuevaVigencia(e.target.value)} className={inputStyle} />
                    </div>
                    <button
                      type="button"
                      onClick={crearNuevaVersion}
                      disabled={creando}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {creando ? 'Creando...' : 'Crear (copia los ítems de esta versión)'}
                    </button>
                    <button type="button" onClick={() => setCreandoVersion(false)} className="text-sm text-slate-500 hover:underline">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
