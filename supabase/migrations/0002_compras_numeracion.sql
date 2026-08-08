-- Numeración correlativa para el módulo de Compras (pedidos, órdenes y
-- pedidos a depósito). Las tablas empresas, pedidos_compra,
-- pedidos_compra_items, ordenes_compra, ordenes_compra_items,
-- pedidos_deposito y pedidos_deposito_items YA EXISTEN en Supabase con sus
-- columnas y políticas RLS. Esta migración SOLO agrega secuencias, funciones
-- trigger y los CREATE TRIGGER correspondientes — no recrea ni altera
-- columnas de ninguna tabla.
--
-- Revisar antes de correr en el SQL Editor de Supabase.

-- =========================================================
-- 1. PEDIDOS_COMPRA -> numero_pedido (PED-0001, PED-0002, ...)
-- =========================================================
create sequence if not exists pedidos_compra_numero_seq;

create or replace function set_numero_pedido_compra()
returns trigger as $$
begin
  if new.numero_pedido is null or new.numero_pedido = '' then
    new.numero_pedido := 'PED-' || lpad(nextval('pedidos_compra_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_pedidos_compra_set_numero
before insert on pedidos_compra
for each row execute function set_numero_pedido_compra();

-- Reutiliza set_updated_at(), ya definida en 0001_proveedores_articulos.sql.
create trigger trg_pedidos_compra_updated_at
before update on pedidos_compra
for each row execute function set_updated_at();


-- =========================================================
-- 2. ORDENES_COMPRA -> numero_oc (OC-0001, OC-0002, ...)
-- =========================================================
create sequence if not exists ordenes_compra_numero_seq;

create or replace function set_numero_orden_compra()
returns trigger as $$
begin
  if new.numero_oc is null or new.numero_oc = '' then
    new.numero_oc := 'OC-' || lpad(nextval('ordenes_compra_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_ordenes_compra_set_numero
before insert on ordenes_compra
for each row execute function set_numero_orden_compra();

create trigger trg_ordenes_compra_updated_at
before update on ordenes_compra
for each row execute function set_updated_at();


-- =========================================================
-- 3. PEDIDOS_DEPOSITO -> numero_pedido_deposito (DEP-0001, ...)
-- =========================================================
create sequence if not exists pedidos_deposito_numero_seq;

create or replace function set_numero_pedido_deposito()
returns trigger as $$
begin
  if new.numero_pedido_deposito is null or new.numero_pedido_deposito = '' then
    new.numero_pedido_deposito := 'DEP-' || lpad(nextval('pedidos_deposito_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_pedidos_deposito_set_numero
before insert on pedidos_deposito
for each row execute function set_numero_pedido_deposito();

create trigger trg_pedidos_deposito_updated_at
before update on pedidos_deposito
for each row execute function set_updated_at();

-- Nota: el insert client-side NO debe enviar numero_pedido / numero_oc /
-- numero_pedido_deposito (o debe enviarlos null/''); el trigger BEFORE
-- INSERT los completa antes de que Postgres valide el UNIQUE. Al venir de
-- una secuencia dedicada (no de un MAX+1 calculado sobre las filas
-- existentes), un borrador borrado nunca libera ni reutiliza su número.
