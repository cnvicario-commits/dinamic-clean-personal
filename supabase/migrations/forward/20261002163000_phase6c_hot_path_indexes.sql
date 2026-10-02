-- Phase 6C: indexes for Phase 6 hot paths (attendance list/export date filters, HR reports, active assignments).
BEGIN;

-- Range scans: GET /v1/attendance (desde/hasta), HR Bejerman/overtime attendance extracts.
-- UNIQUE (empleado_id, fecha) does not accelerate cross-employee fecha ranges.
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha
  ON public.asistencias USING btree (fecha);

-- Active assignment lookups in HR reports and Bejerman client scoping.
CREATE INDEX IF NOT EXISTS idx_asignaciones_active_empleado_cliente
  ON public.asignaciones USING btree (empleado_id, cliente_id)
  WHERE fecha_hasta IS NULL;

COMMIT;
