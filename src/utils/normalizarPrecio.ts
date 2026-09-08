// Interpretación del precio tal como viene de una celda de Excel al importar
// una lista de precios de proveedor. Si Excel lo guardó como número (lo más
// común y seguro: columna con formato numérico), se usa tal cual — el
// formato visual (separador de miles, moneda, etc.) es solo cosmético, el
// valor interno ya es el número correcto.
//
// Si vino como texto, se reconoce el separador decimal real en vez de
// asumir siempre coma: soporta tanto "1.234,56" (miles con punto, decimal
// con coma — formato AR) como "1,234.56" (formato US) sin romper ninguno de
// los dos. Devuelve NaN (no 0) si el texto está vacío o no se puede
// interpretar, para que quede como "precio inválido" en vez de guardarse
// como $0 en silencio.
export function normalizarPrecio(valor: unknown): number {
  if (typeof valor === 'number') return valor
  const texto = String(valor ?? '').trim()
  if (texto === '') return NaN

  const tieneComa = texto.includes(',')
  const tienePunto = texto.includes('.')

  if (tieneComa && tienePunto) {
    // El separador decimal es el que aparece más a la derecha; el otro es
    // separador de miles (puede repetirse, ej. "1.234.567,89") y se
    // descarta por completo, no solo la primera aparición.
    const decimalEsComa = texto.lastIndexOf(',') > texto.lastIndexOf('.')
    const miles = decimalEsComa ? '.' : ','
    const decimal = decimalEsComa ? ',' : '.'
    return Number(texto.split(miles).join('').replace(decimal, '.'))
  }

  if (tieneComa) {
    // Solo coma: convención Argentina, es el separador decimal.
    return Number(texto.replace(',', '.'))
  }

  if (tienePunto) {
    // Solo punto: si tiene exactamente 3 dígitos después, es casi seguro
    // un separador de miles sin decimales (ej. "1.234" = mil doscientos
    // treinta y cuatro), no un precio de $1,234 — un precio real casi
    // nunca se escribe con 3 decimales. Con 1 o 2 dígitos se interpreta
    // como decimal (ej. "1234.56").
    const partes = texto.split('.')
    const digitosDecimales = partes[partes.length - 1].length
    if (partes.length > 1 && digitosDecimales === 3) {
      return Number(partes.join(''))
    }
  }

  return Number(texto)
}
