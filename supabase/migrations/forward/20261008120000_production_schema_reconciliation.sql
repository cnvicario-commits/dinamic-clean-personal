-- Reconciliation for a production-shaped database.
-- Runs after 20261007170000 because that file uses CREATE TABLE IF NOT EXISTS
-- and does not repair leads objects that already exist.
-- Idempotent: a database that already matches TEST is unchanged in outcome.

update public.crm_leads
set updated_at = created_at
where updated_at is null
  and created_at is not null;

update public.crm_leads
set updated_at = now()
where updated_at is null;

alter table public.crm_leads
  alter column updated_at set default now();

alter table public.crm_leads
  alter column updated_at set not null;

alter table public.crm_leads
  drop constraint if exists crm_leads_oportunidad_id_fkey;

alter table public.crm_leads
  add constraint crm_leads_oportunidad_id_fkey
  foreign key (oportunidad_id)
  references public.crm_oportunidades(id)
  on delete set null;

drop trigger if exists trg_crm_seguimientos_leads_actualizar_proxima_fecha
  on public.crm_seguimientos_leads;

drop policy if exists crm_leads_propio_o_admin on public.crm_leads;
drop policy if exists crm_seguimientos_leads_propio_o_admin on public.crm_seguimientos_leads;
drop policy if exists crm_oportunidades_propia_o_admin on public.crm_oportunidades;
drop policy if exists crm_seguimientos_propio_o_admin on public.crm_seguimientos;
drop policy if exists crm_vistas_propia on public.crm_vistas;

revoke insert, update, delete, truncate on public.crm_leads from anon, authenticated;
revoke insert, update, delete, truncate on public.crm_seguimientos_leads from anon, authenticated;
