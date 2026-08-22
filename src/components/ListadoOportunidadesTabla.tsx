'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import EstadoOportunidadBadge from './EstadoOportunidadBadge'
import { ESTADOS, type OportunidadListado, type EstadoOportunidad, type PerfilResumen, type CatalogoItem } from '@/types/crm'

type Columna =
  | 'numero_referencia'
  | 'fecha_ingreso'
  | 'cliente'
  | 'tipo_cliente'
  | 'tipo_servicio'
  | 'monto_estimado'
  | 'estado'
  | 'fecha_envio'
  | 'proxima_fecha_seguimiento'
  | 'responsable'

function comparar(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '-'
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-AR')
}

function formatearMonto(valor: number | null): string {
  if (valor === null) return '-'
  return valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

function valorColumna(o: OportunidadListado, columna: Columna): string {
  switch (columna) {
    case 'numero_referencia':
      return o.numero_referencia ?? ''
    case 'fecha_ingreso':
      return o.fecha_ingreso
    case 'cliente':
      return o.crm_prospectos?.nombre ?? ''
    case 'tipo_cliente':
      return o.crm_prospectos?.crm_tipos_cliente?.nombre ?? ''
    case 'tipo_servicio':
      return o.crm_tipos_servicio?.nombre ?? ''
    case 'monto_estimado':
      return String(o.monto_estimado ?? 0)
    case 'estado':
      return o.estado
    case 'fecha_envio':
      return o.fecha_envio ?? ''
    case 'proxima_fecha_seguimiento':
      return o.proxima_fecha_seguimiento ?? ''
    case 'responsable':
      return o.perfiles?.nombre_completo ?? ''
  }
}

export default function ListadoOportunidadesTabla({
  oportunidades,
  responsables,
  tiposCliente,
}: {
  oportunidades: OportunidadListado[]
  responsables: PerfilResumen[]
  tiposCliente: CatalogoItem[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'' | EstadoOportunidad>('')
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
    let base = oportunidades
    if (q) {
      base = base.filter(
        (o) =>
          (o.crm_prospectos?.nombre ?? '').toLowerCase().includes(q) ||
          (o.numero_referencia ?? '').toLowerCase().includes(q) ||
          (o.comentarios ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroEstado) base = base.filter((o) => o.estado === filtroEstado)
    if (filtroResponsable) base = base.filter((o) => o.responsable_id === filtroResponsable)
    if (filtroTipoCliente) base = base.filter((o) => o.crm_prospectos?.tipo_cliente_id === filtroTipoCliente)

    const signo = direccion === 'asc' ? 1 : -1
    return [...base].sort((a, b) => {
      if (columna === 'monto_estimado') return signo * ((a.monto_estimado ?? 0) - (b.monto_estimado ?? 0))
      return signo * comparar(valorColumna(a, columna), valorColumna(b, columna))
    })
  }, [oportunidades, busqueda, filtroEstado, filtroResponsable, filtroTipoCliente, columna, direccion])

  function exportar() {
    const filas = filtrados.map((o) => ({
      numero_referencia: o.numero_referencia ?? '',
      fecha_ingreso: o.fecha_ingreso,
      cliente: o.crm_prospectos?.nombre ?? '',
      tipo_cliente: o.crm_prospectos?.crm_tipos_cliente?.nombre ?? '',
      contacto: o.crm_prospectos?.contacto_nombre ?? '',
      telefono: o.crm_prospectos?.telefono ?? '',
      email: o.crm_prospectos?.email ?? '',
      referido_por: o.crm_prospectos?.crm_referidores?.nombre ?? '',
      cantidad_personal: o.cantidad_personal ?? '',
      tipo_servicio: o.crm_tipos_servicio?.nombre ?? '',
      monto_estimado: o.monto_estimado ?? '',
      estado: ESTADOS.find((e) => e.valor === o.estado)?.etiqueta ?? o.estado,
      fecha_envio: o.fecha_envio ?? '',
      fecha_seguimiento: o.proxima_fecha_seguimiento ?? '',
      comentarios: o.comentarios ?? '',
      comision: o.comision_monto ?? '',
      responsable: o.perfiles?.nombre_completo ?? '',
    }))
    const hoja = XLSX.utils.json_to_sheet(filas)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Oportunidades')
    const fecha = new Date().toISOString().split('T')[0]
    XLSX.writeFile(libro, `oportunidades_ventas_${fecha}.xlsx`)
  }

  const selectStyle = 'border border-slate-300 rounded-md px-3 py-2 text-sm'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Buscar por cliente, N° o comentarios..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-2 text-sm w-64"
          />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as '' | EstadoOportunidad)} className={selectStyle}>
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
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
        <table className="w-full text-sm min-w-[1280px]">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500 border-b border-slate-200">
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('numero_referencia')}>
                N°{indicador('numero_referencia')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('fecha_ingreso')}>
                Fecha ingreso{indicador('fecha_ingreso')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('cliente')}>
                Cliente{indicador('cliente')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('tipo_cliente')}>
                Tipo cliente{indicador('tipo_cliente')}
              </th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Teléfono/Email</th>
              <th className="px-4 py-3 font-medium">Referido por</th>
              <th className="px-4 py-3 font-medium">Cant. personal</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('tipo_servicio')}>
                Tipo servicio{indicador('tipo_servicio')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('monto_estimado')}>
                Monto estimado{indicador('monto_estimado')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('estado')}>
                Estado{indicador('estado')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('fecha_envio')}>
                Fecha envío{indicador('fecha_envio')}
              </th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('proxima_fecha_seguimiento')}>
                Prox. seguimiento{indicador('proxima_fecha_seguimiento')}
              </th>
              <th className="px-4 py-3 font-medium">Comentarios</th>
              <th className="px-4 py-3 font-medium">Comisión</th>
              <th className="px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-700" onClick={() => ordenarPor('responsable')}>
                Responsable{indicador('responsable')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 text-slate-800">
                  <Link href={`/ventas/${o.id}`} className="text-teal-600 hover:underline">
                    {o.numero_referencia || 'Ver'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatearFecha(o.fecha_ingreso)}</td>
                <td className="px-4 py-3 text-slate-800">{o.crm_prospectos?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{o.crm_prospectos?.crm_tipos_cliente?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{o.crm_prospectos?.contacto_nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[o.crm_prospectos?.telefono, o.crm_prospectos?.email].filter(Boolean).join(' / ') || '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{o.crm_prospectos?.crm_referidores?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{o.cantidad_personal ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">{o.crm_tipos_servicio?.nombre ?? '-'}</td>
                <td className="px-4 py-3 text-slate-600">$ {formatearMonto(o.monto_estimado)}</td>
                <td className="px-4 py-3"><EstadoOportunidadBadge estado={o.estado} /></td>
                <td className="px-4 py-3 text-slate-600">{formatearFecha(o.fecha_envio)}</td>
                <td className="px-4 py-3 text-slate-600">{formatearFecha(o.proxima_fecha_seguimiento)}</td>
                <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate" title={o.comentarios ?? ''}>
                  {o.comentarios ?? '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {o.comision_monto ? `$ ${formatearMonto(o.comision_monto)}` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{o.perfiles?.nombre_completo ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtrados.length === 0 && (
        <p className="text-slate-500 text-sm mt-3">No hay oportunidades que coincidan.</p>
      )}
    </div>
  )
}
