// Generación del código interno correlativo de artículos (ART-0001, ART-0002, ...).
// Se calcula en el cliente a partir del máximo existente en la tabla `articulos`
// porque no se puede depender de un trigger de base de datos para esto (el
// trigger de Postgres para esto nunca llegó a aplicarse en producción: las
// tablas se habían creado antes de correr esa parte de la migración — ver
// commit "Generar codigo_interno de articulos en el cliente en vez de un
// trigger").

import type { SupabaseClient } from '@supabase/supabase-js'

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

// Siguiente código disponible, resuelto en la base en vez de sobre un
// `select('codigo_interno')` de la tabla entera: ese fetch completo queda
// sujeto al límite de filas por defecto de PostgREST (por catálogos
// grandes), lo que podía calcular un máximo por debajo del real y disparar
// colisiones de código en cadena. Acá se filtra por el prefijo "ART-" y se
// ordena descendente en el propio Postgres, así que solo se traen unas
// pocas filas sin importar cuántos artículos haya en total. Los códigos
// están todos con el mismo padding (4 dígitos), así que el orden de texto
// coincide con el orden numérico.
export async function obtenerSiguienteCodigo(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('articulos')
    .select('codigo_interno')
    .ilike('codigo_interno', `${PREFIJO}%`)
    .order('codigo_interno', { ascending: false })
    .limit(5)
  return calcularMaximoCodigo(data ?? []) + 1
}
