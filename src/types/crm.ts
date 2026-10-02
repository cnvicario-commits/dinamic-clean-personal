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
  // Fecha a partir de la cual corresponde empezar a facturar a este cliente
  // nuevo (no es control de facturación recurrente, eso queda fuera de este
  // sistema — ver src/app/ventas/facturacion/page.tsx). Solo tiene sentido
  // cuando estado = 'aceptado'; opcional incluso ahí.
  fecha_facturacion: string | null
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
  // Se completa sola al pasar a aceptado/rechazado/en_espera (migración
  // 0018) — es la fecha que usa el desglose mensual para "aceptadas en el
  // mes" (no fecha_ingreso, que es cuando se cargó, no cuando se cerró).
  fecha_cierre: string | null
  monto_estimado: number | null
  comision_monto: number | null
  comision_liquidada: boolean
  responsable_id: string | null
  responsable_nombre_libre: string | null
  tipo_servicio_id: string | null
  crm_prospectos: {
    tipo_cliente_id: string | null
    crm_tipos_cliente: { nombre: string } | null
    crm_referidores: { nombre: string } | null
  } | null
  crm_tipos_servicio: { nombre: string } | null
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

// =========================================================
// Leads: seguimiento comercial previo a que exista una Oportunidad concreta
// (ver supabase/migrations/0036_crm_leads.sql). A diferencia de las
// oportunidades, un lead siempre tiene responsable_id con cuenta en la app
// (no hay historial importado sin usuario acá), así que no hace falta un
// equivalente a responsable_nombre_libre.
// =========================================================

export type EstadoLead = 'por_contactar' | 'en_conversacion' | 'convertido' | 'sin_interes'

export const ESTADOS_LEAD: { valor: EstadoLead; etiqueta: string }[] = [
  { valor: 'por_contactar', etiqueta: 'Por contactar' },
  { valor: 'en_conversacion', etiqueta: 'En conversación' },
  { valor: 'convertido', etiqueta: 'Convertido a oportunidad' },
  { valor: 'sin_interes', etiqueta: 'Sin interés' },
]

export type CrmLead = {
  id: string
  prospecto_id: string
  responsable_id: string
  estado: EstadoLead
  proxima_fecha_contacto: string | null
  notas: string | null
  oportunidad_id: string | null
  fecha_conversion: string | null
  created_at: string
  updated_at: string | null
}

// Vista con los joins ya resueltos, tal como la trae el Tablero de Leads.
export type LeadVista = CrmLead & {
  crm_prospectos: {
    id: string
    nombre: string
    tipo_cliente_id: string | null
    contacto_nombre: string | null
    telefono: string | null
  } | null
  perfiles: { nombre_completo: string } | null
}

// Vista más completa para el Listado y la ficha: incluye datos de contacto
// del prospecto y el nombre del referidor.
export type LeadListado = CrmLead & {
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
  perfiles: { nombre_completo: string } | null
}

export type SeguimientoLead = {
  id: string
  lead_id: string
  fecha_contacto: string
  tipo_contacto: string | null
  nota: string | null
  proxima_fecha_contacto: string | null
  usuario_id: string
  created_at: string
  perfiles: { nombre_completo: string } | null
}

// =========================================================
// Agenda unificada: combina vencimientos de Oportunidades (próximo
// seguimiento) y de Leads (próximo contacto) en una sola lista para que el
// vendedor tenga un solo lugar donde mirar qué le vence. Se arma en el
// server component (src/app/ventas/agenda/page.tsx) a partir de las dos
// consultas, normalizando cada una a esta forma común.
// =========================================================
export type TipoItemAgenda = 'oportunidad' | 'lead'

export type ItemAgenda = {
  id: string
  tipo: TipoItemAgenda
  href: string
  cliente: string
  subtitulo: string
  fecha: string | null
  responsableId: string | null
  responsableNombre: string
  montoTexto: string | null
}
