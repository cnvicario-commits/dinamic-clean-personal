// Arma links "click to chat" de WhatsApp (wa.me) para prospectos del CRM de
// ventas. No usa ninguna librería ni API: es el formato estándar
// https://wa.me/<numero> (sin mensaje precargado, a pedido — abre el chat
// con el campo de texto en blanco).

// Limpia un teléfono guardado en formato local argentino (con espacios,
// guiones, con o sin 0/15) y lo deja en el formato que espera WhatsApp:
// 54 (código de país) + 9 (indicador de celular) + el número sin 0 ni 15.
// Devuelve null si después de limpiar no queda algo con pinta de teléfono
// real, para no armar nunca un link a un número roto.
export function limpiarTelefono(raw: string): string | null {
  let digits = raw.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('0')) digits = digits.slice(1)
  // Formato viejo tipo "11 15 XXXX-XXXX": el 15 va pegado al código de área.
  digits = digits.replace(/^(11)15/, '$1')

  if (digits.startsWith('549')) {
    // Ya viene con código de país + 9.
  } else if (digits.startsWith('54')) {
    digits = '549' + digits.slice(2)
  } else {
    digits = '549' + digits
  }

  // Un celular argentino en este formato queda en 13 dígitos (549 + 10).
  // Si quedó mucho más corto, no tiene pinta de teléfono real.
  if (digits.length < 12) return null
  return digits
}

export function armarLinkWhatsapp(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const limpio = limpiarTelefono(telefono)
  if (!limpio) return null
  return `https://wa.me/${limpio}`
}
