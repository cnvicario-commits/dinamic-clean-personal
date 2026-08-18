// Normalización de codigo_proveedor SOLO para comparar al matchear la carga
// de listas de precios contra lo ya guardado en articulos_proveedor. El
// valor persistido en la base sigue siendo siempre el texto original tal
// cual vino del Excel — esta función nunca se usa para guardar, solo para
// decidir si dos códigos son "el mismo".
export function normalizarCodigoProveedor(codigo: string): string {
  const compacto = codigo.trim().replace(/\s+/g, ' ').toLowerCase()
  // Sacar ceros a la izquierda solo si el código es puramente numérico
  // (si tiene letras u otros caracteres, se deja como está).
  return /^\d+$/.test(compacto) ? String(parseInt(compacto, 10)) : compacto
}
