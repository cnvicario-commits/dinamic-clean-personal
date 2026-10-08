'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { CrmMonthlySummary } from '@/lib/api/generated'

function filas(serie: CrmMonthlySummary['creadas'], categorias: string[]) {
  return serie.map((punto) => {
    const fila: Record<string, string | number> = { mes: punto.mes, total: punto.total }
    for (const categoria of categorias) fila[categoria] = 0
    for (const categoria of punto.categorias) fila[categoria.nombre] = categoria.cantidad
    return fila
  })
}

function Grafico({ data, categorias }: { data: Record<string, string | number>[]; categorias: string[] }) {
  const colores = ['#0d9488', '#16a34a', '#2a78d6', '#eb6834', '#eda100', '#4a3aa7', '#e34948', '#94a3b8']
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {categorias.map((categoria, index) => (
          <Bar key={categoria} dataKey={categoria} stackId="a" fill={colores[index % colores.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function DesgloseMensualVentas({ resumen }: { resumen: CrmMonthlySummary }) {
  const creadas = filas(resumen.creadas, resumen.categorias)
  const aceptadas = filas(resumen.aceptadas, resumen.categorias)
  const totales = resumen.creadas.map((punto, index) => ({
    mes: punto.mes,
    Creadas: punto.total,
    Aceptadas: resumen.aceptadas[index]?.total ?? 0,
  }))

  return (
    <div className="mb-8 space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Creadas vs aceptadas, por mes</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={totales}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Creadas" fill="#0d9488" />
            <Bar dataKey="Aceptadas" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Creadas por mes</h2>
        <Grafico data={creadas} categorias={resumen.categorias} />
      </div>
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Aceptadas por mes</h2>
        <Grafico data={aceptadas} categorias={resumen.categorias} />
      </div>
    </div>
  )
}
