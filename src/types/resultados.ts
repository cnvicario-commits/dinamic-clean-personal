// Tipos del módulo de Resultados económicos. Independiente de Compras y
// RRHH, tabla propia (resultados_mensuales) — solo guarda totales por
// rubro, nunca el detalle interno (sueldos, insumos, etc.).

export type ResultadoMensual = {
  id: string
  anio: number
  mes: number // 1-12
  ventas_dinamic: number | null
  ventas_moral: number | null
  total_ventas: number | null
  total_costos_directos: number | null
  resultado_bruto: number | null
  total_rrhh: number | null
  total_estructura_servicios: number | null
  total_honorarios_abonos: number | null
  total_gastos_financieros: number | null
  total_gastos_comerciales: number | null
  total_otros_gastos: number | null
  total_impuestos: number | null
  resultado_periodo: number | null
  created_at: string
  updated_at: string
}

// Campos numéricos importables/graficables (todo menos id/anio/mes/timestamps).
export type CampoResultado = keyof Omit<ResultadoMensual, 'id' | 'anio' | 'mes' | 'created_at' | 'updated_at'>

// Detalle de conceptos por rubro (una fila del Excel entre el encabezado
// de sección, ej. "COSTOS DIRECTOS", y su fila "TOTAL X"), para el
// desplegable de cada rubro con detalle en el panel.
export type ResultadoMensualDetalle = {
  id: string
  anio: number
  mes: number
  rubro: string
  concepto: string
  monto: number | null
}

// Rubros con detalle desplegable: todos los "total_*" del Excel salvo
// total_ventas (que ya se desglosa aparte en Ventas Dinamic/Moral) y los
// campos calculados (resultado_bruto, resultado_periodo, que no son una
// lista de conceptos del Excel).
export const CAMPOS_CON_DETALLE: CampoResultado[] = [
  'total_costos_directos',
  'total_rrhh',
  'total_estructura_servicios',
  'total_honorarios_abonos',
  'total_gastos_financieros',
  'total_gastos_comerciales',
  'total_otros_gastos',
  'total_impuestos',
]

// 'total_recursos_humanos' -> 'recursos_humanos': mismo criterio que ya se
// usaba para costos_directos, generalizado. Usado tanto por el importador
// (valor guardado en la columna `rubro`) como por el panel (para filtrar
// el detalle de cada fila).
export function rubroSlugDeCampo(campo: CampoResultado): string {
  return campo.replace(/^total_/, '')
}

// Metadatos de cada rubro, en el mismo orden que aparecen en el Excel
// original — reutilizado tanto por el importador (matching de etiquetas)
// como por el panel (filas de la tabla comparativa).
export const RUBROS: { campo: CampoResultado; etiqueta: string; esIncidenciaSobreVentas: boolean }[] = [
  { campo: 'ventas_dinamic', etiqueta: 'Ventas Dinamic', esIncidenciaSobreVentas: false },
  { campo: 'ventas_moral', etiqueta: 'Ventas Moral', esIncidenciaSobreVentas: false },
  { campo: 'total_ventas', etiqueta: 'Total Ventas', esIncidenciaSobreVentas: false },
  { campo: 'total_costos_directos', etiqueta: 'Total Costos Directos', esIncidenciaSobreVentas: true },
  { campo: 'resultado_bruto', etiqueta: 'Resultado Bruto', esIncidenciaSobreVentas: true },
  { campo: 'total_rrhh', etiqueta: 'Total Recursos Humanos', esIncidenciaSobreVentas: true },
  { campo: 'total_estructura_servicios', etiqueta: 'Total Estructura y Servicios', esIncidenciaSobreVentas: true },
  { campo: 'total_honorarios_abonos', etiqueta: 'Total Honorarios y Abonos', esIncidenciaSobreVentas: true },
  { campo: 'total_gastos_financieros', etiqueta: 'Total Gastos Financieros', esIncidenciaSobreVentas: true },
  { campo: 'total_gastos_comerciales', etiqueta: 'Total Gastos Comerciales', esIncidenciaSobreVentas: true },
  { campo: 'total_otros_gastos', etiqueta: 'Total Otros Gastos', esIncidenciaSobreVentas: true },
  { campo: 'total_impuestos', etiqueta: 'Total Impuestos', esIncidenciaSobreVentas: true },
  { campo: 'resultado_periodo', etiqueta: 'Resultado del Período', esIncidenciaSobreVentas: true },
]

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function formatearMesAnio(anio: number, mes: number): string {
  return `${MESES_CORTOS[mes - 1] ?? mes} ${anio}`
}

// Clave de orden cronológico comparable (mayor = más reciente).
export function clavePeriodo(anio: number, mes: number): number {
  return anio * 12 + mes
}
