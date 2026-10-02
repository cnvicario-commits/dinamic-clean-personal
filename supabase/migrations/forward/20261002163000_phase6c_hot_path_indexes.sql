-- Phase 6C: hot-path index review (evidence-driven; no speculative indexes).
-- Target DB inspection (2026-10-02): asistencias date-range list/count and Bejerman/overtime
-- attendance extracts already use Bitmap Index Scan on asistencias_empleado_id_fecha_key
-- for fecha bounds; a standalone idx_asistencias(fecha) would duplicate that access path.
-- asignaciones active lookups (fecha_hasta IS NULL) showed Seq Scan at current volume (est_rows=0);
-- partial (empleado_id, cliente_id) was not demonstrated to improve real report SQL and does not
-- align with cliente_id-first EXISTS filters without measurement at representative row counts.
BEGIN;
COMMIT;
