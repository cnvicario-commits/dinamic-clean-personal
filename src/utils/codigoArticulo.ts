// Generación del código interno correlativo de artículos (ART-0001, ART-0002, ...).
// Se calcula en el cliente a partir del máximo existente en la tabla `articulos`
// porque no se puede depender de un trigger de base de datos para esto.

const PREFIJO = 'ART-'
const DIGITOS = 4

export function parsearNumeroCodigo(codigo: string): number | null {
  const match = /^ART-(\d+)$/.exec(codigo.trim())
  return match ? parseInt(match[1], 10) : null
}

export function formatearCodigoArticulo(numero: number): string {
  return `${PREFIJO}${String(numero).padStart(DIGITOS, '0')}`
}

export function calcularMaximoCodigo(articulos: { codigo_interno: string }[]): number {
  let maximo = 0
  for (const a of articulos) {
    const n = parsearNumeroCodigo(a.codigo_interno)
    if (n !== null && n > maximo) maximo = n
  }
  return maximo
}
