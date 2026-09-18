-- CRM de Ventas: fecha de facturación de una oportunidad Aceptada.
-- No es control de facturación recurrente (eso lo maneja el área de
-- facturación aparte, fuera de este sistema) — es solo un aviso de "a
-- partir de esta fecha hay que empezar a facturar a este cliente nuevo".
-- Por eso alcanza con un campo simple, no hace falta tabla de historial.
-- Opcional: no bloquea el alta ni el paso a Aceptado, se carga después
-- desde la ficha de la oportunidad cuando se sepa la fecha real.
-- Revisar antes de correr en el SQL Editor de Supabase.

alter table crm_oportunidades
  add column if not exists fecha_facturacion date;
