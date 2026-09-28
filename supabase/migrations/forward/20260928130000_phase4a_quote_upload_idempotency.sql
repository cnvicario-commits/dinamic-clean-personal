-- Phase 4A final correction: durable upload idempotency, scoped to actor + client.
BEGIN;

CREATE TABLE IF NOT EXISTS public.cliente_presupuesto_upload_idempotency (
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.perfiles(id),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 255),
  payload_hash text NOT NULL CHECK (char_length(payload_hash) = 64),
  status text NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  quote_id uuid REFERENCES public.cliente_presupuestos(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cliente_id, actor_id, idempotency_key),
  CHECK ((status = 'COMPLETED') = (quote_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS cliente_presupuesto_upload_idempotency_processing_idx
  ON public.cliente_presupuesto_upload_idempotency (updated_at)
  WHERE status = 'PROCESSING';

ALTER TABLE public.cliente_presupuesto_upload_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cliente_presupuesto_upload_idempotency FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cliente_presupuesto_upload_idempotency TO dinamic_api;

DROP POLICY IF EXISTS cliente_presupuesto_upload_idempotency_dinamic_api_all ON public.cliente_presupuesto_upload_idempotency;
CREATE POLICY cliente_presupuesto_upload_idempotency_dinamic_api_all
  ON public.cliente_presupuesto_upload_idempotency
  FOR ALL TO dinamic_api USING (true) WITH CHECK (true);

COMMIT;
