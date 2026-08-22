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
  responsable_id: string
  proxima_fecha_seguimiento: string | null
  created_at: string
  updated_at: string | null
}

// Vista con los joins ya resueltos, tal como la trae el Tablero (server
// component): prospecto (+ su tipo de cliente, para poder filtrar), tipo de
// servicio y responsable.
export type OportunidadVista = CrmOportunidad & {
  crm_prospectos: { id: string; nombre: string; tipo_cliente_id: string | null } | null
  crm_tipos_servicio: { nombre: string } | null
  perfiles: { nombre_completo: string } | null
}
