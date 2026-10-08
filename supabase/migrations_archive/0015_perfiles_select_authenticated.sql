-- Permite que cualquier usuario logueado pueda LEER todos los perfiles
-- (necesario para mostrar "Creado por" con el nombre de quien hizo cada
-- pedido, no solo el propio). No toca insert/update/delete: eso sigue
-- restringido por las políticas que ya existan sobre perfiles.
-- Revisar antes de correr en el SQL Editor de Supabase.

create policy "perfiles_select_authenticated" on perfiles
  for select to authenticated using (true);
