-- POST /v1/purchase-orders has no natural key: numero_oc is assigned by the database.
-- Two orders with the same lines can be legitimate, so the retry protection is the request key.
-- Not applied to production by this change.

alter table public.purchase_operation_idempotency
  drop constraint if exists purchase_operation_idempotency_operation_check;

alter table public.purchase_operation_idempotency
  add constraint purchase_operation_idempotency_operation_check
  check (operation in (
    'purchase_request_import',
    'purchase_order_generate',
    'purchase_request_create',
    'purchase_order_create'
  ));
