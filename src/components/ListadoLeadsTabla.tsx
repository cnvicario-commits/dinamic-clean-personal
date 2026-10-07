'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import type { CrmLead, CrmLeadState } from '@/lib/api/generated'
import type { PerfilResumen } from '@/types/crm'
import { ESTADOS_LEAD } from './TableroLeads'

export default function ListadoLeadsTabla({ leads, responsables }: { leads: CrmLead[]; responsables: PerfilResumen[] }) {
  const [estado, setEstado] = useState<'' | CrmLeadState>('')
  const [responsable, setResponsable] = useState('')
  const visibles = useMemo(
    () => leads.filter((lead) => (!estado || lead.estado === estado) && (!responsable || lead.responsable_id === responsable)),
    [leads, estado, responsable],
  )

  function exportar() {
    const filas = visibles.map((lead) => ({
      Cliente: lead.crm_prospectos?.nombre ?? '',
      Estado: ESTADOS_LEAD.find((item) => item.valor === lead.estado)?.etiqueta ?? lead.estado,
      Responsable: lead.perfiles?.nombre_completo ?? '',
      Proximo: lead.proxima_fecha_contacto ?? '',
      Notas: lead.notas ?? '',
    }))
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Leads')
    XLSX.writeFile(libro, 'leads_pagina.xlsx')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={estado} onChange={(e) => setEstado(e.target.value as '' | CrmLeadState)} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">Todos los estados</option>
          {ESTADOS_LEAD.map((item) => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}
        </select>
        <select value={responsable} onChange={(e) => setResponsable(e.target.value)} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
          <option value="">Todos los responsables</option>
          {responsables.map((item) => <option key={item.id} value={item.id}>{item.nombre_completo}</option>)}
        </select>
        <button type="button" onClick={exportar} className="px-3 py-2 text-sm rounded-md bg-slate-100">Exportar página</button>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3">Próximo contacto</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-3 text-slate-400">Sin leads en esta página.</td></tr>
            ) : visibles.map((lead) => (
              <tr key={lead.id} className="border-t border-slate-100">
                <td className="px-4 py-3"><Link href={`/ventas/leads/${lead.id}`} className="text-teal-700 hover:underline">{lead.crm_prospectos?.nombre ?? '-'}</Link></td>
                <td className="px-4 py-3">{ESTADOS_LEAD.find((item) => item.valor === lead.estado)?.etiqueta ?? lead.estado}</td>
                <td className="px-4 py-3">{lead.perfiles?.nombre_completo ?? '-'}</td>
                <td className="px-4 py-3">{lead.proxima_fecha_contacto ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
