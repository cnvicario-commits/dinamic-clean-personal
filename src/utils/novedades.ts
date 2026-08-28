// Cálculo de "novedades" del CRM de Ventas: seguimientos cargados a mano por
// OTRO usuario que el usuario actual todavía no vio en la ficha de esa
// oportunidad. Ver migración 0024_crm_vistas_oportunidad.sql (tabla
// crm_vistas) y el componente MarcarOportunidadVista (quien la actualiza).
//
// Deliberadamente NO cuenta acá: altas de oportunidad, cambios de etapa, ni
// ediciones de campos de la ficha — solo seguimientos/notas, que es lo único
// que hoy queda registrado con quién y cuándo (ver crm_seguimientos).

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
  usuarioActualId,
}: {
  seguimientos: SeguimientoParaNovedad[]
  vistas: VistaOportunidad[]
  usuarioActualId: string
}): Map<string, Novedad> {
  const vistoPor = new Map(vistas.map((v) => [v.oportunidad_id, v.last_viewed_at]))
  const novedades = new Map<string, Novedad>()

  for (const s of seguimientos) {
    // Las notas automáticas de cambio de estado que arma TableroVentas.tsx
    // se insertan sin tipo_contacto — eso las distingue de un seguimiento
    // cargado a mano vía RegistrarSeguimientoForm, que siempre trae uno.
    if (!s.tipo_contacto) continue
    // Lo que cargué yo mismo no es una novedad para mí.
    if (s.usuario_id === usuarioActualId) continue

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
