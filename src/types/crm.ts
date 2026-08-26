// Tipos del módulo CRM de seguimiento de ventas. Independiente de Compras y
// RRHH; centralizado acá (no local por componente) porque son varias tablas
// muy relacionadas usadas por muchos componentes distintos — mismo criterio
// que src/types/compras.ts.

export type EstadoOportunidad = 'en_seguimiento' | 'aceptado' | 'rechazado' | 'en_espera'

export const ESTADOS: { valor: EstadoOportunidad; etiqueta: string }[] = [
  { valor: 'en_seguimiento', etiqueta: 'En seguimiento' },
  { valor: 'aceptado', etiqueta: 'Aceptado' },
  { valor: 'rechazado', etiqueta: 'Rechazado' },
  { valor: 'en_espera', etiqueta: 'En espera' },
]

// Ítem genérico de los 3 catálogos editables (crm_tipos_cliente,
// crm_tipos_servicio, crm_referidores) — misma forma en los tres.
export type CatalogoItem = { id: string; nombre: string }

export type PerfilResumen = { id: string; nombre_completo: string }

export type CrmProspecto = {
  id: string
  nombre: string
  tipo_cliente_id: string | null
  contacto_nombre: string | null
  telefono: string | null
  email: string | null
  referido_por_id: string | null
  notas: string | null
  created_at: string
  updated_at: string | null
}

export type CrmOportunidad = {
  id: string
  prospecto_id: string
  numero_referencia: string | null
  fecha_ingreso: string
  tipo_servicio_id: string | null
  cantidad_personal: number | null
  monto_estimado: number | null
  estado: EstadoOportunidad
  fecha_envio: string | null
  fecha_cierre: string | null
  comision_monto: number | null
  comision_liquidada: boolean
  comentarios: string | null
  // responsable_id es null cuando quien gestionó la oportunidad no tiene cuenta en la
  // app (ej. historial importado de gente que ya no trabaja acá o nunca tuvo login) —
  // en ese caso el nombre queda en responsable_nombre_libre. Nunca los dos en null.
  responsable_id: string | null
  responsable_nombre_libre: string | null
  proxima_fecha_seguimiento: string | null
  created_at: string
  updated_at: string | null
}

// Nombre a mostrar del responsable de una oportunidad, sea cuenta real (perfiles) o
// texto libre (histórico sin cuenta en la app).
export function nombreResponsable(o: { perfiles: { nombre_completo: string } | null; responsable_nombre_libre: string | null }): string {
  return o.perfiles?.nombre_completo ?? o.responsable_nombre_libre ?? '-'
}

// Mismo criterio, para quién registró un seguimiento (crm_seguimientos.usuario_id /
// usuario_nombre_libre).
export function nombreUsuarioSeguimiento(s: { perfiles: { nombre_completo: string } | null; usuario_nombre_libre: string | null }): string {
  return s.perfiles?.nombre_completo ?? s.usuario_nombre_libre ?? '-'
}

// Vista con los joins ya resueltos, tal como la trae el Tablero (server
// component): prospecto (+ su tipo de cliente, para poder filtrar), tipo de
// servicio y responsable.
export type OportunidadVista = CrmOportunidad & {
  crm_prospectos: {
    id: string
    nombre: string
    tipo_cliente_id: string | null
    contacto_nombre: string | null
    telefono: string | null
  } | null
  crm_tipos_servicio: { nombre: string } | null
  perfiles: { nombre_completo: string } | null
}

// Vista liviana para el Resumen ejecutivo: solo lo necesario para agrupar y
// sumar (estado, monto, comisión, tipo de cliente, responsable) — no trae
// datos de contacto ni de seguimiento, que ahí no se muestran.
export type OportunidadResumen = {
  id: string
  estado: EstadoOportunidad
  fecha_ingreso: string
  monto_estimado: number | null
  comision_monto: number | null
  comision_liquidada: boolean
  responsable_id: string | null
  responsable_nombre_libre: string | null
  crm_prospectos: {
    tipo_cliente_id: string | null
    crm_tipos_cliente: { nombre: string } | null
    crm_referidores: { nombre: string } | null
  } | null
  perfiles: { nombre_completo: string } | null
}

// Vista más completa para el Listado tipo planilla: incluye los datos de
// contacto del prospecto y el nombre del referidor, que el Tablero no
// necesita mostrar.
export type OportunidadListado = CrmOportunidad & {
  crm_prospectos: {
    id: string
    nombre: string
    tipo_cliente_id: string | null
    contacto_nombre: string | null
    telefono: string | null
    email: string | null
    referido_por_id: string | null
    crm_tipos_cliente: { nombre: string } | null
    crm_referidores: { nombre: string } | null
  } | null
  crm_tipos_servicio: { nombre: string } | null
  perfiles: { nombre_completo: string } | null
}
