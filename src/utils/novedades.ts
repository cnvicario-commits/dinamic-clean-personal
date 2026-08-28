// Cálculo de "novedades" del CRM de Ventas: cualquier fila de
// crm_seguimientos (nota manual o nota automática de cambio de estado del
// Kanban — ambas cuentan como "una novedad") que el usuario actual todavía
// no vio en la ficha de esa oportunidad, sin importar quién la cargó (incluye
// las propias: si edito una oportunidad y vuelvo al tablero sin volver a
// entrar a la ficha, también me aparece como novedad, a propósito). Ver
// migración 0024_crm_vistas_oportunidad.sql (tabla crm_vistas) y el
// componente MarcarOportunidadVista (quien la actualiza).
//
// Deliberadamente NO cuenta acá: altas de oportunidad ni ediciones de campos
// de la ficha (monto, fecha de envío, comisión, datos de contacto) — esas no
// dejan ningún rastro en crm_seguimientos hoy.

export type SeguimientoParaNovedad = {
  oportunidad_id: string
  usuario_id: string | null
  usuario_nombre_libre: string | null
  tipo_contacto: string | null
  nota: string | null
  created_at: string
  perfiles: { nombre_completo: string } | null
}

export type VistaOportunidad = { oportunidad_id: string; last_viewed_at: string }

export type Novedad = {
  oportunidadId: string
  cantidad: number
  ultimo: SeguimientoParaNovedad
}

export function calcularNovedades({
  seguimientos,
  vistas,
}: {
  seguimientos: SeguimientoParaNovedad[]
  vistas: VistaOportunidad[]
}): Map<string, Novedad> {
  const vistoPor = new Map(vistas.map((v) => [v.oportunidad_id, v.last_viewed_at]))
  const novedades = new Map<string, Novedad>()

  for (const s of seguimientos) {
    const ultimaVista = vistoPor.get(s.oportunidad_id)
    if (ultimaVista && new Date(s.created_at) <= new Date(ultimaVista)) continue

    const existente = novedades.get(s.oportunidad_id)
    if (!existente) {
      novedades.set(s.oportunidad_id, { oportunidadId: s.oportunidad_id, cantidad: 1, ultimo: s })
    } else {
      existente.cantidad += 1
      if (new Date(s.created_at) > new Date(existente.ultimo.created_at)) existente.ultimo = s
    }
  }

  return novedades
}
