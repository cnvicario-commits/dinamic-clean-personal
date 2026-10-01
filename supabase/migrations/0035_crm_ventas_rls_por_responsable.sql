-- Hasta ahora crm_oportunidades/crm_seguimientos/crm_vistas tenían RLS
-- habilitado pero con policies permisivas (using (true)): cualquier
-- autenticado podía leer/escribir cualquier fila, y lo único que separaba
-- "ver todo" de "ver lo propio" era la UI (ver src/utils/permisos.ts). Con el
-- rol 'ventas' conviviendo con 'admin'/'gerente' en el mismo módulo, eso deja
-- de alcanzar: ahora se exige a nivel de base que cada quien solo pueda
-- leer/crear/editar sus propias oportunidades (y lo que cuelga de ellas),
-- salvo 'admin', que sigue viendo y pudiendo tocar todo.
-- Revisar antes de correr en el SQL Editor de Supabase.

-- crm_oportunidades: propia (responsable_id = auth.uid()) o admin.
drop policy "crm_oportunidades_authenticated_all" on crm_oportunidades;

create policy "crm_oportunidades_propia_o_admin" on crm_oportunidades
  for all to authenticated
  using (
    responsable_id = auth.uid()
    or exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin')
  )
  with check (
    responsable_id = auth.uid()
    or exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin')
  );

-- crm_seguimientos: no se mira quién cargó el seguimiento, sino de quién es
-- la oportunidad a la que pertenece (es el historial de ESA oportunidad).
drop policy "crm_seguimientos_authenticated_all" on crm_seguimientos;

create policy "crm_seguimientos_propio_o_admin" on crm_seguimientos
  for all to authenticated
  using (
    exists (
      select 1 from crm_oportunidades
      where crm_oportunidades.id = crm_seguimientos.oportunidad_id
        and crm_oportunidades.responsable_id = auth.uid()
    )
    or exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin')
  )
  with check (
    exists (
      select 1 from crm_oportunidades
      where crm_oportunidades.id = crm_seguimientos.oportunidad_id
        and crm_oportunidades.responsable_id = auth.uid()
    )
    or exists (select 1 from perfiles where perfiles.id = auth.uid() and perfiles.rol = 'admin')
  );

-- crm_vistas: es el "ya vi esto" de cada usuario sobre cada oportunidad, no
-- datos del negocio — siempre acotado a la propia marca, sin excepción para
-- admin (admin no necesita ver ni tocar las marcas de otros).
drop policy "crm_vistas_authenticated_all" on crm_vistas;

create policy "crm_vistas_propia" on crm_vistas
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
