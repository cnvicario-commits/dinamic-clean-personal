'use client'
import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { nombreResponsable, type OportunidadResumen, type CatalogoItem, type PerfilResumen } from '@/types/crm'
import {
  CATEGORIA_OTROS,
  agruparPorMesYCategoria,
  enumerarMeses,
  formatearMesClave,
  topCategorias,
  type FilaMensual,
} from '@/utils/resumenMensual'

// Paleta categórica validada (ver skill de dataviz — orden fijo, nunca
// ciclada; más de 8 categorías se pliegan en "Otros" con gris neutro en vez
// de generar un 9° color).
const COLORES_CATEGORIA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const COLOR_OTROS = '#94a3b8' // slate-400: gris neutro, no compite con la paleta categórica
const COLOR_CREADAS = '#0d9488' // teal-600, mismo acento que el resto de Ventas
const COLOR_ACEPTADAS = '#16a34a' // emerald-600 (ya usado para "Aceptado" en EstadoOportunidadBadge)

type Dimension = 'tipo_servicio' | 'responsable'

function hoyStr(): string {
  const hoy = new Date()
  const offset = hoy.getTimezoneOffset()
  return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10)
}

function mesesAtras(cantidad: number): string {
  const hoy = new Date()
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - cantidad, 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`
}

function colorDeCategoria(categoria: string, categoriasPrincipales: string[]): string {
  if (categoria === CATEGORIA_OTROS) return COLOR_OTROS
  const indice = categoriasPrincipales.indexOf(categoria)
  return indice >= 0 ? COLORES_CATEGORIA[indice] : COLOR_OTROS
}

function Grafico({ filas, categorias }: { filas: FilaMensual[]; categorias: string[] }) {
  const categoriasPrincipales = categorias.filter((c) => c !== CATEGORIA_OTROS)
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={filas} margin={{ top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" />
        <XAxis dataKey="mesEtiqueta" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        {categorias.length > 1 && <Legend />}
        {categorias.map((categoria) => (
          <Bar
            key={categoria}
            dataKey={categoria}
            name={categoria}
            stackId="a"
            fill={colorDeCategoria(categoria, categoriasPrincipales)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

// Panorama general sin desglose: dos barras lado a lado por mes (no
// apiladas, son dos medidas distintas — creadas y aceptadas no se suman
// entre sí), con los mismos acentos que ya usa el resto de Ventas.
function GraficoTotales({ filas }: { filas: { mesEtiqueta: string; Creadas: number; Aceptadas: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={filas} margin={{ top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" />
        <XAxis dataKey="mesEtiqueta" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Creadas" fill={COLOR_CREADAS} />
        <Bar dataKey="Aceptadas" fill={COLOR_ACEPTADAS} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function Tabla({ filas, categorias, mostrarTotal = true }: { filas: FilaMensual[]; categorias: string[]; mostrarTotal?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="px-3 py-2 font-medium">{categorias.length > 1 ? 'Categoría' : ''}</th>
            {filas.map((f) => (
              <th key={f.mes} className="px-3 py-2 font-medium text-right whitespace-nowrap">{f.mesEtiqueta}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categorias.map((categoria) => (
            <tr key={categoria} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{categoria}</td>
              {filas.map((f) => (
                <td key={f.mes} className="px-3 py-1.5 text-right text-slate-600">{(f[categoria] as number) ?? 0}</td>
              ))}
            </tr>
          ))}
          {mostrarTotal && (
            <tr className="font-semibold text-slate-800 bg-slate-50">
              <td className="px-3 py-1.5">Total</td>
              {filas.map((f) => (
                <td key={f.mes} className="px-3 py-1.5 text-right">{f.total}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Desglose mensual de Oportunidades creadas y aceptadas, con corte por tipo
// de servicio o por responsable (toggle). Reutiliza el mismo filtro
// Desde/Hasta y de responsable del Resumen ejecutivo (ResumenEjecutivoVentas.tsx)
// — "creadas" filtra por fecha_ingreso, "aceptadas" por fecha_cierre (se
// completa sola al pasar a aceptado, ver migración 0018), así que una misma
// oportunidad puede contar distinto mes en cada gráfico si se cerró en un
// mes distinto al que ingresó.
export default function DesgloseMensualVentas({
  oportunidades,
  tiposServicio,
  responsables,
  fechaDesde,
  fechaHasta,
  filtroResponsable,
}: {
  oportunidades: OportunidadResumen[]
  tiposServicio: CatalogoItem[]
  responsables: PerfilResumen[]
  fechaDesde: string
  fechaHasta: string
  filtroResponsable: string
}) {
  const [dimension, setDimension] = useState<Dimension>('tipo_servicio')

  const obtenerCategoria = useMemo(() => {
    if (dimension === 'tipo_servicio') {
      return (o: OportunidadResumen) => o.crm_tipos_servicio?.nombre ?? 'Sin tipo de servicio'
    }
    return (o: OportunidadResumen) => nombreResponsable(o)
  }, [dimension])

  const { filasTotales, filasCreadas, filasAceptadas, categorias } = useMemo(() => {
    const porResponsable = filtroResponsable
      ? oportunidades.filter((o) => o.responsable_id === filtroResponsable)
      : oportunidades

    // Si no se eligió un rango, por defecto muestra los últimos 12 meses en
    // vez de todo el historial completo (podría ser mucho para un gráfico).
    const desdeEfectiva = fechaDesde || mesesAtras(11)
    const hastaEfectiva = fechaHasta || hoyStr()
    const meses = enumerarMeses(desdeEfectiva, hastaEfectiva)

    const creadas = porResponsable.filter((o) => o.fecha_ingreso >= desdeEfectiva && o.fecha_ingreso <= hastaEfectiva)
    const aceptadas = porResponsable.filter(
      (o) => o.estado === 'aceptado' && o.fecha_cierre && o.fecha_cierre >= desdeEfectiva && o.fecha_cierre <= hastaEfectiva
    )

    // Una sola lista de categorías "top" para los dos gráficos, para que la
    // misma categoría tenga siempre el mismo color sea cual sea su peso en
    // cada uno (el color sigue a la entidad, no a su ranking — ver skill de
    // dataviz).
    const categoriasPrincipales = topCategorias([...creadas, ...aceptadas], obtenerCategoria)

    const filasCreadas = agruparPorMesYCategoria(creadas, (o) => o.fecha_ingreso, obtenerCategoria, categoriasPrincipales, meses)
    const filasAceptadas = agruparPorMesYCategoria(
      aceptadas,
      (o) => o.fecha_cierre!,
      obtenerCategoria,
      categoriasPrincipales,
      meses
    )

    const hayOtros =
      filasCreadas.some((f) => (f[CATEGORIA_OTROS] as number) > 0) || filasAceptadas.some((f) => (f[CATEGORIA_OTROS] as number) > 0)

    // Totales simples (sin desglose) para el panorama general arriba de todo.
    const porMesCreadas = new Map(filasCreadas.map((f) => [f.mes, f.total]))
    const porMesAceptadas = new Map(filasAceptadas.map((f) => [f.mes, f.total]))
    const filasTotales = meses.map((mes) => ({
      mes,
      mesEtiqueta: formatearMesClave(mes),
      Creadas: porMesCreadas.get(mes) ?? 0,
      Aceptadas: porMesAceptadas.get(mes) ?? 0,
    }))

    return {
      filasTotales,
      filasCreadas,
      filasAceptadas,
      categorias: hayOtros ? [...categoriasPrincipales, CATEGORIA_OTROS] : categoriasPrincipales,
    }
  }, [oportunidades, fechaDesde, fechaHasta, filtroResponsable, obtenerCategoria])

  const etiquetaDimension = dimension === 'tipo_servicio' ? 'tipo de servicio' : 'responsable'

  return (
    <div className="mb-8">
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Oportunidades creadas vs. aceptadas, por mes
        </h2>
        <GraficoTotales filas={filasTotales} />
        <div className="mt-3">
          <Tabla
            filas={filasTotales.map((f) => ({ mes: f.mes, mesEtiqueta: f.mesEtiqueta, total: 0, Creadas: f.Creadas, Aceptadas: f.Aceptadas }))}
            categorias={['Creadas', 'Aceptadas']}
            mostrarTotal={false}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Oportunidades por mes, por {etiquetaDimension}
        </h2>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setDimension('tipo_servicio')}
            className={`px-3 py-1.5 text-sm rounded-lg ${dimension === 'tipo_servicio' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Por tipo de servicio
          </button>
          <button
            type="button"
            onClick={() => setDimension('responsable')}
            className={`px-3 py-1.5 text-sm rounded-lg ${dimension === 'responsable' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            Por responsable
          </button>
        </div>
      </div>

      {tiposServicio.length === 0 && responsables.length === 0 && (
        <p className="text-xs text-slate-400 mb-3">Sin catálogos cargados para desglosar.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Creadas por mes</h3>
          <Grafico filas={filasCreadas} categorias={categorias} />
          <div className="mt-3">
            <Tabla filas={filasCreadas} categorias={categorias} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Aceptadas por mes
          </h3>
          <Grafico filas={filasAceptadas} categorias={categorias} />
          <div className="mt-3">
            <Tabla filas={filasAceptadas} categorias={categorias} />
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2">
        &ldquo;Creadas&rdquo; se cuenta por fecha de ingreso; &ldquo;Aceptadas&rdquo; por fecha de cierre (cuando pasó a
        Aceptado) — una oportunidad puede quedar en un mes distinto en cada gráfico si se cerró después de ingresar.
      </p>
    </div>
  )
}
