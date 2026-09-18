-- =============================================================================
-- Storage buckets — structural reproduction (no objects / no secrets)
-- Captured from Development test project 2026-09-17
-- Buckets are private (public = false). MIME/size limits were NULL in source.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('justificaciones', 'justificaciones', false),
  ('presupuestos-clientes', 'presupuestos-clientes', false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;
