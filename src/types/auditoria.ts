// Tipos del módulo Auditoría y Calidad. Independiente de Ventas y Compras;
// centralizado acá (no local por componente) porque son varias tablas muy
// relacionadas usadas por varios componentes — mismo criterio que
// src/types/crm.ts y src/types/compras.ts.
//
// "alias_id" en las tablas de Supabase apunta en realidad a
// cliente_domicilios(id) — no existe una tabla `alias` separada, ver
// supabase/migrations/0028_auditoria_calidad.sql.

export type ChecklistPlantilla = {
  id: string
  codigo_formulario: string
  version: string
  vigencia_desde: string
  activa: boolean
  created_at: string
}

export type ChecklistItem = {
  id: string
  plantilla_id: string
  orden: number
  texto: string
  created_at: string
}

export type EstadoPlanificacion = 'planificada' | 'realizada' | 'vencida' | 'cancelada'

export type PlanificacionListado = {
  id: string
  fecha_propuesta: string
  // 'vencida' nunca viene de la base (el enum de la columna no la incluye)
  // — se calcula en el front a partir de 'planificada' + fecha vencida. Se
  // permite acá para que el mismo tipo sirva antes y después de calcularlo.
  estado: EstadoPlanificacion
  supervisor_id: string
  cliente_domicilios: { alias: string; direccion: string | null; clientes: { nombre: string } | null } | null
  perfiles: { nombre_completo: string } | null
}

export type ResultadoRespuesta = 'conforme' | 'no_conforme' | 'no_aplica'

export type EstadoPlanAccion = 'pendiente' | 'en_curso' | 'resuelto'

export type RespuestaFicha = {
  id: string
  resultado: ResultadoRespuesta
  observaciones: string | null
  auditoria_checklist_items: { orden: number; texto: string } | null
}

export type PlanAccionItem = {
  id: string
  descripcion: string
  responsable_id: string | null
  fecha_limite: string | null
  estado: EstadoPlanAccion
  fecha_resolucion: string | null
  created_at: string
  respuesta_id: string | null
  perfiles: { nombre_completo: string } | null
  auditoria_respuestas: { auditoria_checklist_items: { texto: string } | null } | null
}

// Plana a propósito (solo auditoria_id, no el detalle del cliente/sitio
// repetido en cada fila): el detalle se busca en AuditoriaResumen por id,
// una sola vez por auditoría en vez de una vez por respuesta.
export type RespuestaDashboard = {
  auditoria_id: string
  resultado: ResultadoRespuesta
  auditoria_checklist_items: { texto: string } | null
}

export type AuditoriaResumen = {
  id: string
  fecha_realizada: string
  quejas_comentarios_cliente: string | null
  cliente_domicilios: { alias: string; clientes: { nombre: string } | null } | null
  perfiles: { nombre_completo: string } | null
}

export type PlanificacionResumen = { estado: EstadoPlanificacion; fecha_propuesta: string }

export type PlanAccionResumen = { estado: EstadoPlanAccion; fecha_limite: string | null }

export type AuditoriaListado = {
  id: string
  fecha_realizada: string
  evaluacion_general: string | null
  cliente_domicilios: { alias: string; direccion: string | null; clientes: { nombre: string } | null } | null
  perfiles: { nombre_completo: string } | null
}

// Solo lo necesario para contar no conformidades por auditoría en el
// listado — no trae observaciones ni el texto del ítem, eso es cosa de la
// ficha (ver AuditoriaFicha / RespuestaFicha).
export type RespuestaConteo = { auditoria_id: string; resultado: ResultadoRespuesta }

export type PlanAccionSeguimiento = {
  id: string
  descripcion: string
  estado: EstadoPlanAccion
  fecha_limite: string | null
  fecha_resolucion: string | null
  auditoria_id: string
  perfiles: { nombre_completo: string } | null
  auditorias: {
    fecha_realizada: string
    cliente_domicilios: { alias: string; clientes: { nombre: string } | null } | null
  } | null
  auditoria_respuestas: { auditoria_checklist_items: { texto: string } | null } | null
}

export type AuditoriaFicha = {
  id: string
  alias_id: string
  fecha_realizada: string
  evaluacion_general: string | null
  proxima_supervision_fecha: string | null
  quejas_comentarios_cliente: string | null
  otros: string | null
  cliente_domicilios: { alias: string; direccion: string | null; clientes: { nombre: string } | null } | null
  auditoria_checklist_plantillas: { codigo_formulario: string; version: string } | null
  perfiles: { nombre_completo: string } | null
}
