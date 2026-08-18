-- Habilita pg_trgm (similitud de texto) y agrega la función usada para
-- sugerir artículos por parecido de nombre al cargar listas de precios,
-- cuando una fila no matchea por código (vacío o distinto al guardado).
-- Revisar antes de correr en el SQL Editor de Supabase.

create extension if not exists pg_trgm;

create index if not exists articulos_proveedor_nombre_trgm_idx
  on articulos_proveedor using gin (nombre_proveedor gin_trgm_ops);

-- p_umbral 0.35: similarity() de pg_trgm compara trigramas de caracteres,
-- no palabras completas, así que para nombres reales de productos rara vez
-- llega a 0.80 aunque sean "el mismo" a simple vista. Se puede ajustar más
-- adelante con un CREATE OR REPLACE FUNCTION de una línea.
create or replace function buscar_articulos_similares(
  p_proveedor_id uuid,
  p_nombre text,
  p_limite int default 3,
  p_umbral real default 0.35
)
returns table (
  articulo_id uuid,
  codigo_interno text,
  nombre text,
  similitud real
)
language sql
stable
as $$
  select a.id, a.codigo_interno, a.nombre,
         similarity(lower(ap.nombre_proveedor), lower(p_nombre)) as similitud
  from articulos_proveedor ap
  join articulos a on a.id = ap.articulo_id
  where ap.proveedor_id = p_proveedor_id
    and ap.nombre_proveedor is not null
    and similarity(lower(ap.nombre_proveedor), lower(p_nombre)) >= p_umbral
  order by similitud desc
  limit p_limite;
$$;

grant execute on function buscar_articulos_similares(uuid, text, int, real) to authenticated;
