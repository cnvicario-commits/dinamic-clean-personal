// Utilidades para el desglose mensual del Resumen ejecutivo de Ventas
// (DesgloseMensualVentas.tsx): agrupar oportunidades por mes y por una
// categoría (tipo de servicio o responsable), con las categorías de menor
// peso plegadas en "Otros" — mismo criterio de "top N + Otros" que evita
// gráficos de torta/barras con demasiadas series para distinguir a simple
// vista (ver skill de dataviz: la paleta categórica valida 8 colores).

export const CATEGORIA_OTROS = 'Otros'
const MAX_CATEGORIAS = 7 // + "Otros" = 8, el techo de la paleta categórica

export function mesClave(fechaISO: string): string {
  return fechaISO.slice(0, 7) // "2026-03-15" -> "2026-03"
}

export function formatearMesClave(clave: string): string {
  return new Date(`${clave}-01T00:00:00`).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
}

// Lista de claves "AAAA-MM" entre dos fechas (inclusive), para que el
// gráfico muestre también los meses sin datos en vez de saltearlos.
export function enumerarMeses(fechaDesde: string, fechaHasta: string): string[] {
  const [anioDesde, mesDesde] = mesClave(fechaDesde).split('-').map(Number)
  const [anioHasta, mesHasta] = mesClave(fechaHasta).split('-').map(Number)
  const meses: string[] = []
  let anio = anioDesde
  let mes = mesDesde
  // Tope de seguridad: si por error desde > hasta, no entra en loop infinito.
  let iteraciones = 0
  while ((anio < anioHasta || (anio === anioHasta && mes <= mesHasta)) && iteraciones < 600) {
    meses.push(`${anio}-${String(mes).padStart(2, '0')}`)
    mes += 1
    if (mes > 12) {
      mes = 1
      anio += 1
    }
    iteraciones += 1
  }
  return meses
}

// Las categorías con más casos en todo el rango, hasta MAX_CATEGORIAS; el
// resto se pliega en "Otros" al armar los datos del gráfico/tabla.
export function topCategorias<T>(items: T[], obtenerCategoria: (item: T) => string): string[] {
  const totales = new Map<string, number>()
  for (const item of items) {
    const categoria = obtenerCategoria(item)
    totales.set(categoria, (totales.get(categoria) ?? 0) + 1)
  }
  return Array.from(totales.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CATEGORIAS)
    .map(([categoria]) => categoria)
}

export type FilaMensual = { mes: string; mesEtiqueta: string; total: number } & Record<string, number | string>

// Arma una fila por mes con una columna por categoría (+ "Otros" si
// corresponde) y el total del mes, lista para pasarle directo a un
// <BarChart> de recharts o a una tabla.
export function agruparPorMesYCategoria<T>(
  items: T[],
  obtenerFecha: (item: T) => string,
  obtenerCategoria: (item: T) => string,
  categoriasPrincipales: string[],
  meses: string[]
): FilaMensual[] {
  const categoriasSet = new Set(categoriasPrincipales)
  const porMes = new Map<string, Map<string, number>>()
  for (const mes of meses) porMes.set(mes, new Map())

  for (const item of items) {
    const mes = mesClave(obtenerFecha(item))
    const bucket = porMes.get(mes)
    if (!bucket) continue // fuera del rango de meses enumerado
    const categoriaCruda = obtenerCategoria(item)
    const categoria = categoriasSet.has(categoriaCruda) ? categoriaCruda : CATEGORIA_OTROS
    bucket.set(categoria, (bucket.get(categoria) ?? 0) + 1)
  }

  return meses.map((mes) => {
    const bucket = porMes.get(mes) ?? new Map()
    const fila: FilaMensual = { mes, mesEtiqueta: formatearMesClave(mes), total: 0 }
    let total = 0
    for (const categoria of bucket.keys()) {
      const cantidad = bucket.get(categoria) ?? 0
      fila[categoria] = cantidad
      total += cantidad
    }
    fila.total = total
    return fila
  })
}
