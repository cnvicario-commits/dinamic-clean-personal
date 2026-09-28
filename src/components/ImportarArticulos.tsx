'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createAuthenticatedBrowserApiClient } from '@/lib/api/browser'
import DescargarPlantillaArticulos from './DescargarPlantillaArticulos'

type Resumen = { creados:number; actualizados:number }

export default function ImportarArticulos() {
  const [abierto,setAbierto]=useState(false); const [archivo,setArchivo]=useState<File|null>(null)
  const [procesando,setProcesando]=useState(false); const [error,setError]=useState(''); const [resumen,setResumen]=useState<Resumen|null>(null); const router=useRouter()
  async function submit(e:React.FormEvent) {
    e.preventDefault(); setError(''); setResumen(null)
    if(!archivo){setError('Elegí un archivo .xlsx o .csv.');return}
    setProcesando(true)
    try {
      const libro=archivo.name.toLowerCase().endsWith('.csv')?XLSX.read(await archivo.text(),{type:'string'}):XLSX.read(await archivo.arrayBuffer(),{type:'array'})
      const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(libro.Sheets[libro.SheetNames[0]])
      if(!raw.length||!Object.keys(raw[0]).includes('nombre')) throw new Error('El archivo debe tener la columna nombre y al menos una fila.')
      const invalidas:number[]=[]
      const rows=raw.flatMap((r,index)=>{const nombre=String(r.nombre??'').trim();if(!nombre){invalidas.push(index+2);return []}return [{fila:index+2,codigoInterno:String(r.codigo_interno??'').trim(),nombre,categoria:String(r.categoria??'').trim()||null,unidad:String(r.unidad??'').trim()||null}]})
      if(invalidas.length) throw new Error(`Filas inválidas: ${invalidas.join(', ')}. No se aplicó ningún cambio.`)
      const result=await (await createAuthenticatedBrowserApiClient()).importArticles({rows},crypto.randomUUID())
      setResumen(result.response);setArchivo(null);router.refresh()
    } catch(err) { setError(err instanceof Error?err.message:'Error al procesar el archivo') } finally { setProcesando(false) }
  }
  return <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6"><button type="button" onClick={()=>setAbierto(!abierto)} className="text-sm font-medium text-teal-600 hover:underline">{abierto?'Ocultar importación masiva':'Importar desde Excel'}</button>{abierto&&<div className="mt-4 flex flex-col gap-4"><p className="text-sm text-slate-600">El archivo debe tener <code>nombre</code>; código interno, categoría y unidad son opcionales. La API valida y persiste el lote completo de forma transaccional.</p><DescargarPlantillaArticulos/><form onSubmit={submit} className="flex flex-wrap gap-2"><input type="file" accept=".xlsx,.csv" onChange={e=>setArchivo(e.target.files?.[0]??null)}/><button disabled={procesando} className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg disabled:opacity-50">{procesando?'Procesando...':'Importar artículos'}</button></form>{error&&<p className="text-rose-600 text-sm">{error}</p>}{resumen&&<p className="text-sm text-emerald-700">Creados: {resumen.creados}. Actualizados: {resumen.actualizados}.</p>}</div>}</div>
}
