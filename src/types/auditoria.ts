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

export type ResultadoRespuesta = 'conforme' | 'no_conforme' | 'no_aplica'

export type EstadoPlanAccion = 'pendiente' | 'en_curso' | 'resuelto'
