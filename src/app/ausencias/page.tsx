'use client'
import { useEffect, useState } from 'react'
import AusenciaForm from '@/components/AusenciaForm'
import ReporteBejerman from '@/components/ReporteBejerman'
import ReporteHorasExtraCliente from '@/components/ReporteHorasExtraCliente'
import ExportarAusencias from '@/components/ExportarAusencias'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import type { AttendanceItem, AssignmentListItem } from '@/lib/api/generated/types'

type ExportRow = { fecha:string; codigo:string; horas_extras:number; observaciones:string|null; empleados:{nombre_apellido:string}|null }
async function allAssignments(api: Awaited<ReturnType<typeof createAuthenticatedBrowserApiClient>>) {
  const pageSize=100, first=await api.listAssignments({active:true,page:1,pageSize}), pages=Math.ceil(first.total/pageSize)
  const rows=[...first.items]; for(let p=2;p<=pages;p+=1){const next=await api.listAssignments({active:true,page:p,pageSize}); rows.push(...next.items)}
  return rows
}
async function allAttendance(api: Awaited<ReturnType<typeof createAuthenticatedBrowserApiClient>>) {
  const pageSize=100, first=await api.listAttendance({page:1,pageSize}), pages=Math.ceil(first.total/pageSize)
  const rows=[...first.items]; for(let p=2;p<=pages;p+=1){const next=await api.listAttendance({page:p,pageSize}); rows.push(...next.items)}
  return rows
}
function exportRows(items:AttendanceItem[]): ExportRow[] { return items.map(a=>({fecha:a.fecha,codigo:a.codigo,horas_extras:a.horasExtras,observaciones:a.observaciones,empleados:a.empleadoNombre?{nombre_apellido:a.empleadoNombre}:null})) }

export default function AusenciasPage(){
  const [page,setPage]=useState(1), pageSize=25, [total,setTotal]=useState(0)
  const [state,setState]=useState<{employees:{id:string;nombre_apellido:string}[];clients:{id:string;nombre:string}[];assignments:{empleado_id:string;cliente_id:string}[];items:AttendanceItem[];exportItems:ExportRow[];codes:{codigo:string;descripcion:string}[]}|null>(null)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{let live=true;(async()=>{try{const api=await createAuthenticatedBrowserApiClient();const [catalogs,attendance,codes,assignments,exportItems]=await Promise.all([api.getHrCatalogs('employees,clients'),api.listAttendance({page,pageSize}),api.listAttendanceCodes(),allAssignments(api),allAttendance(api)]);if(live){setTotal(attendance.total);setState({employees:catalogs.employees,clients:catalogs.clients,assignments:assignments.map((x:AssignmentListItem)=>({empleado_id:x.empleado_id,cliente_id:x.cliente_id})),items:attendance.items,exportItems:exportRows(exportItems),codes})}}catch(e){if(live)setError(e instanceof Error?e.message:'No se pudo cargar novedades')}})();return()=>{live=false}},[page])
  if(error)return <div role="alert" className="max-w-4xl mx-auto px-4 py-10 text-rose-700">{error}</div>
  if(!state)return <div className="max-w-4xl mx-auto px-4 py-10">Cargando novedades…</div>
  const pages=Math.max(1,Math.ceil(total/pageSize))
  return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10"><h1 className="text-2xl font-bold text-slate-900 mb-6">Novedades</h1><div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5"><AusenciaForm empleados={state.employees} clientes={state.clients} asignaciones={state.assignments} codigos={state.codes}/></div><div className="bg-white border border-slate-200 rounded-lg shadow-sm p-5 mt-8"><ReporteBejerman/><ReporteHorasExtraCliente/></div><div className="flex items-center justify-between mt-8 mb-3"><h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Listado ({total})</h2><ExportarAusencias asistencias={state.exportItems}/></div><div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="px-4 py-3">Empleado</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Horas extra</th><th className="px-4 py-3">Observaciones</th><th className="px-4 py-3">Archivo</th></tr></thead><tbody>{state.items.map(a=><tr key={a.id} className="border-b"><td className="px-4 py-3">{a.empleadoNombre}</td><td className="px-4 py-3">{a.fecha}</td><td className="px-4 py-3">{a.codigo}</td><td className="px-4 py-3">{a.horasExtras||'-'}</td><td className="px-4 py-3">{a.observaciones||'-'}</td><td className="px-4 py-3">{a.archivoUrl?<a href={a.archivoUrl} target="_blank" rel="noreferrer">Ver</a>:'-'}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between mt-3"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div>{total===0&&<p className="text-slate-500 text-sm mt-3">No hay novedades cargadas todavía.</p>}</div>
}
