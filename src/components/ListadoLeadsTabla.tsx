'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { ESTADOS_LEAD, type LeadListado, type EstadoLead, type PerfilResumen, type CatalogoItem } from '@/types/crm'

type Columna = 'fecha_ingreso' | 'cliente' | 'tipo_cliente' | 'estado' | 'proxima_fecha_contacto' | 'responsable'

function comparar(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

function valorColumna(l: LeadListado, columna: Columna): string {
  switch (columna) {
    case 'fecha_ingreso':
      return l.created_at
    case 'cliente':
      return l.crm_prospectos?.nombre ?? ''
    case 'tipo_cliente':
      return l.crm_prospectos?.crm_tipos_cliente?.nombre ?? ''
    case 'estado':
      return l.estado
    case 'proxima_fecha_contacto':
      return l.proxima_fecha_contacto ?? ''
    case 'responsable':
      return l.perfiles?.nombre_completo ?? ''
  }
}

const ESTILOS_ESTADO: Record<EstadoLead, string> = {
  por_contactar: 'bg-slate-100 text-slate-700',
  en_conversacion: 'bg-amber-100 text-amber-700',
  convertido: 'bg-emerald-100 text-emerald-700',
  sin_interes: 'bg-rose-100 text-rose-700',
}

export default function ListadoLeadsTabla({
  leads,
  responsables,
  tiposCliente,
}: {
  leads: LeadListado[]
  responsables: PerfilResumen[]
  tiposCliente: CatalogoItem[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'' | EstadoLead>('')
  const [filtroResponsable, setFiltroResponsable] = useState('')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('')
  const [columna, setColumna] = useState<Columna>('fecha_ingreso')
  const [direccion, setDireccion] = useState<'asc' | 'desc'>('desc')

  function ordenarPor(col: Columna) {
    if (columna === col) setDireccion(direccion === 'asc' ? 'desc' : 'asc')
    else {
      setColumna(col)
      setDireccion('asc')
    }
  }

  function indicador(col: Columna) {
    if (columna !== col) return ''
    return direccion === 'asc' ? ' ▲' : ' ▼'
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    let base = leads
    if (q) {
      base = base.filter(
        (l) =>
          (l.crm_prospectos?.nombre ?? '').toLowerCase().includes(q) ||
          (l.notas ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroEstado) base = base.filter((l) => l.estado === filtroEstado)
    if (filtroResponsable) base = base.filter((l) => l.responsable_id === filtroResponsable)
    if (filtroTipoCliente) base = base.filter((l) => l.crm_prospectos?.tipo_cliente_id === filtroTipoCliente)

    const signo = direccion === 'asc' ? 1 : -1
    return [...base].sort((a, b) => signo * comparar(valorColumna(a, columna), valorColumna(b, columna)))
  }, [leads, busqueda, filtroEstado, filtroResponsable, filtroTipoCliente, columna, direccion])

  function exportar() {
    const filas = filtrados.map((l) => ({
      fecha_ingreso: formatearFecha(l.created_at.slice(0, 10)),
      cliente: l.crm_prospectos?.nombre ?? '',
      tipo_cliente: l.crm_prospectos?.crm_tipos_cliente?.nombre ?? '',
      contacto: l.crm_prospectos?.contacto_nombre ?? '',
      telefono: l.crm_prospectos?.telefono ?? '',
      estado: ESTADOS_LEAD.find((e) => e.valor === l.estado)?.etiqueta ?? l.estado,
      proximo_contacto: formatearFecha(l.proxima_fecha_contacto),
      notas: l.notas ?? '',
      responsable: l.perfiles?.nombre_completo ?? '',
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Leads')
    const fecha = new Date().toISOString().split('T')[0]
    XLSX.writeFile(libro, `leads_ventas_${fecha}.xlsx`)
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Buscar por cliente o notas..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm w-64"
          />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as '' | EstadoLead)} className={selectStyle}>
            <option value="">Todos los estados</option>
            {ESTADOS_LEAD.map((e) => (
              <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
            ))}
          </select>
          <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className={selectStyle}>
            <option value="">Todos los responsables</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre_completo}</option>
            ))}
          </select>
          <select value={filtroTipoCliente} onChange={(e) => setFiltroTipoCliente(e.target.value)} className={selectStyle}>
            <option value="">Todos los tipos de cliente</option>
            {tiposCliente.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportar}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Exportar a Excel
        </button>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Listado ({filtrados.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('fecha_ingreso')}>
                Creado{indicador('fecha_ingreso')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('cliente')}>
                Cliente{indicador('cliente')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('tipo_cliente')}>
                Tipo cliente{indicador('tipo_cliente')}
              </th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('estado')}>
                Estado{indicador('estado')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('proxima_fecha_contacto')}>
                Próximo contacto{indicador('proxima_fecha_contacto')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('responsable')}>
                Responsable{indicador('responsable')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-600">{formatearFecha(l.created_at.slice(0, 10))}</td>
                <td className="px-4 py-3 text-slate-800">
                  <Link href={`/ventas/leads/${l.id}`} className="text-teal-600 hover:underline">
                    {l.crm_prospectos?.nombre ?? 'Ver'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.crm_prospectos?.crm_tipos_cliente?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{l.crm_prospectos?.contacto_nombre ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${ESTILOS_ESTADO[l.estado]}`}>
                    {ESTADOS_LEAD.find((e) => e.valor === l.estado)?.etiqueta ?? l.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatearFecha(l.proxima_fecha_contacto)}</td>
                <td className="px-4 py-3 text-slate-600">{l.perfiles?.nombre_completo ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay leads que coincidan.</p>
      )}
    </div>
  )
}
