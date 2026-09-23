-- ============================================================================
--  PULSO LOCAL AI — Row Level Security
-- ----------------------------------------------------------------------------
--  La autorización vive AQUÍ, en la base, no en el código de la aplicación.
--  Si mañana un Route Handler tiene un fallo y consulta sin filtrar por
--  negocio, Postgres sigue sin devolver datos de otro cliente. Es la única
--  defensa que no depende de que nadie se equivoque escribiendo una query.
--
--  Tres principios:
--    1. El público (rol anon) SOLO LEE contenido publicado de negocios
--       vigentes. Nunca escribe y nunca ve un dato personal.
--    2. Todo formulario público entra por Route Handler con service_role,
--       que valida con Zod, comprueba honeypot y límite de peticiones. Por eso
--       no hay una sola política de INSERT para anon.
--    3. Un miembro solo ve lo de SU negocio. El superadmin ve todo.
-- ============================================================================

-- ============================================================================
--  FUNCIONES DE APOYO
-- ----------------------------------------------------------------------------
--  SECURITY DEFINER a propósito: se ejecutan como el propietario de las tablas,
--  así que no vuelven a pasar por RLS. Sin esto, una política sobre
--  business_members que consultara business_members entraría en recursión.
-- ============================================================================

create or replace function is_superadmin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_superadmin from profiles where id = auth.uid()), false);
$$;

create or replace function role_in(p_business uuid)
returns app_role language sql stable security definer set search_path = public, pg_temp as $$
  select role from business_members
   where business_id = p_business and profile_id = auth.uid()
   limit 1;
$$;

-- El enum se ordena owner, admin, staff, viewer, así que comparar con < daría
-- lo contrario de lo que parece. Un nivel numérico explícito evita el error.
create or replace function role_level(r app_role)
returns integer language sql immutable as $$
  select case r
    when 'owner'  then 4
    when 'admin'  then 3
    when 'staff'  then 2
    when 'viewer' then 1
    else 0 end;
$$;

create or replace function can_at_least(p_business uuid, p_min app_role)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select is_superadmin()
      or role_level(role_in(p_business)) >= role_level(p_min);
$$;

-- ¿Este negocio se sirve al público ahora mismo?
-- Es la comprobación de la demo de 7 días, y está aquí además de en el
-- servidor: aunque alguien llame a la API directamente, no lee nada.
create or replace function business_is_live(p_business uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from businesses b
     where b.id = p_business
       and (b.status = 'active'
            or (b.status = 'trial' and b.trial_ends_at is not null and b.trial_ends_at > now()))
  );
$$;

-- Contenido visible para el público: publicado (o agotado, que se enseña
-- tachado) y dentro de fechas si las tiene.
create or replace function content_is_public(
  p_status content_status, p_from date default null, p_to date default null)
returns boolean language sql immutable as $$
  select p_status in ('published', 'sold_out')
     and (p_from is null or p_from <= current_date)
     and (p_to   is null or p_to   >= current_date);
$$;

-- ============================================================================
--  ACTIVAR RLS EN TODAS LAS TABLAS
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','businesses','business_members','business_templates','business_settings',
    'subscriptions','trial_settings','menu_categories','menu_items','menu_item_allergens',
    'menu_item_extras','daily_menus','daily_menu_items','special_menus','events',
    'promotions','faqs','ai_knowledge_entries','legal_text_versions','reservations',
    'group_requests','leads','feedback','consent_records','qr_codes','analytics_events'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ============================================================================
--  PERFILES
-- ============================================================================

create policy perfil_propio_lee on profiles
  for select using (id = auth.uid() or is_superadmin());

create policy perfil_propio_actualiza on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================================
--  NEGOCIOS
-- ============================================================================

-- El público ve la ficha de un negocio vigente. Un negocio caducado no existe
-- para el mundo: la aplicación redirige a /b/<slug>/expirada.
create policy negocio_publico_lee on businesses
  for select using (business_is_live(id) or can_at_least(id, 'viewer'));

create policy negocio_owner_actualiza on businesses
  for update using (can_at_least(id, 'owner')) with check (can_at_least(id, 'owner'));

create policy negocio_superadmin_inserta on businesses
  for insert with check (is_superadmin());

create policy negocio_superadmin_borra on businesses
  for delete using (is_superadmin());

-- ============================================================================
--  MIEMBROS Y AJUSTES
-- ============================================================================

create policy miembros_lee on business_members
  for select using (profile_id = auth.uid() or can_at_least(business_id, 'admin'));

create policy miembros_gestiona on business_members
  for all using (can_at_least(business_id, 'owner'))
  with check (can_at_least(business_id, 'owner'));

create policy plantillas_lee on business_templates
  for select using (true);

create policy plantillas_gestiona on business_templates
  for all using (is_superadmin()) with check (is_superadmin());

-- Los ajustes que lee la página pública son públicos por naturaleza:
-- dirección, teléfono, redes, horario, colores y la URL de reseñas.
create policy ajustes_publico_lee on business_settings
  for select using (business_is_live(business_id) or can_at_least(business_id, 'viewer'));

create policy ajustes_admin_escribe on business_settings
  for all using (can_at_least(business_id, 'admin'))
  with check (can_at_least(business_id, 'admin'));

-- Lo comercial no lo ve el público en ningún caso.
create policy suscripciones_lee on subscriptions
  for select using (can_at_least(business_id, 'owner'));

create policy suscripciones_superadmin on subscriptions
  for all using (is_superadmin()) with check (is_superadmin());

create policy trial_lee on trial_settings
  for select using (can_at_least(business_id, 'owner'));

create policy trial_superadmin on trial_settings
  for all using (is_superadmin()) with check (is_superadmin());

-- ============================================================================
--  CONTENIDO: público lee lo publicado; el equipo gestiona lo suyo
-- ============================================================================

create policy categorias_publico on menu_categories
  for select using (
    (business_is_live(business_id) and content_is_public(status))
    or can_at_least(business_id, 'viewer'));

create policy categorias_equipo on menu_categories
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

create policy platos_publico on menu_items
  for select using (
    (business_is_live(business_id) and content_is_public(status, available_from, available_to))
    or can_at_least(business_id, 'viewer'));

create policy platos_equipo on menu_items
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

-- Alérgenos y complementos no tienen business_id: heredan del plato. Si el
-- plato no es visible, sus alérgenos tampoco.
create policy alergenos_publico on menu_item_allergens
  for select using (exists (select 1 from menu_items i where i.id = item_id));

create policy alergenos_equipo on menu_item_allergens
  for all using (exists (select 1 from menu_items i
                          where i.id = item_id and can_at_least(i.business_id, 'staff')))
  with check (exists (select 1 from menu_items i
                       where i.id = item_id and can_at_least(i.business_id, 'staff')));

create policy extras_publico on menu_item_extras
  for select using (exists (select 1 from menu_items i where i.id = item_id));

create policy extras_equipo on menu_item_extras
  for all using (exists (select 1 from menu_items i
                          where i.id = item_id and can_at_least(i.business_id, 'staff')))
  with check (exists (select 1 from menu_items i
                       where i.id = item_id and can_at_least(i.business_id, 'staff')));

create policy menu_dia_publico on daily_menus
  for select using (
    (business_is_live(business_id) and content_is_public(status))
    or can_at_least(business_id, 'viewer'));

create policy menu_dia_equipo on daily_menus
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

create policy menu_dia_platos_publico on daily_menu_items
  for select using (exists (select 1 from daily_menus m where m.id = daily_menu_id));

create policy menu_dia_platos_equipo on daily_menu_items
  for all using (exists (select 1 from daily_menus m
                          where m.id = daily_menu_id and can_at_least(m.business_id, 'staff')))
  with check (exists (select 1 from daily_menus m
                       where m.id = daily_menu_id and can_at_least(m.business_id, 'staff')));

create policy menus_especiales_publico on special_menus
  for select using (
    (business_is_live(business_id) and content_is_public(status, starts_on, ends_on))
    or can_at_least(business_id, 'viewer'));

create policy menus_especiales_equipo on special_menus
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

create policy eventos_publico on events
  for select using (
    (business_is_live(business_id) and content_is_public(status))
    or can_at_least(business_id, 'viewer'));

create policy eventos_equipo on events
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

create policy promos_publico on promotions
  for select using (
    (business_is_live(business_id) and content_is_public(status, starts_on, ends_on))
    or can_at_least(business_id, 'admin'));

create policy promos_equipo on promotions
  for all using (can_at_least(business_id, 'admin'))
  with check (can_at_least(business_id, 'admin'));

create policy faqs_publico on faqs
  for select using (
    (business_is_live(business_id) and content_is_public(status))
    or can_at_least(business_id, 'viewer'));

create policy faqs_equipo on faqs
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

-- El asistente lee esto desde el servidor con service_role. El público no
-- necesita verlo, y menos lo que aún no está aprobado por el negocio.
create policy ia_equipo on ai_knowledge_entries
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

-- Los textos legales sí son públicos: quien consiente tiene derecho a leerlos.
create policy legales_publico on legal_text_versions
  for select using (business_id is null or business_is_live(business_id)
                    or can_at_least(business_id, 'viewer'));

create policy legales_owner on legal_text_versions
  for all using (can_at_least(business_id, 'owner'))
  with check (can_at_least(business_id, 'owner'));

-- ============================================================================
--  DATOS PERSONALES
-- ----------------------------------------------------------------------------
--  Sin política para anon: el público NO los lee ni los escribe desde el
--  navegador. Entran por Route Handler con service_role, que salta RLS y es
--  quien valida, limita y sanea.
-- ============================================================================

create policy reservas_equipo on reservations
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

create policy grupos_equipo on group_requests
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

create policy contactos_equipo on leads
  for all using (can_at_least(business_id, 'admin'))
  with check (can_at_least(business_id, 'admin'));

create policy feedback_equipo on feedback
  for all using (can_at_least(business_id, 'staff'))
  with check (can_at_least(business_id, 'staff'));

-- El consentimiento es la prueba de que alguien aceptó algo: se lee, no se
-- toca. Ni siquiera el dueño puede editarlo, solo el superadmin borrarlo al
-- ejercer un derecho de supresión.
create policy consentimientos_lee on consent_records
  for select using (can_at_least(business_id, 'owner'));

create policy consentimientos_borra on consent_records
  for delete using (is_superadmin());

-- ============================================================================
--  MEDICIÓN
-- ============================================================================

-- El token del QR lo resuelve el servidor. Si el público pudiera listar
-- qr_codes, sabría dónde está cada cartel de cada cliente.
create policy qr_equipo on qr_codes
  for all using (can_at_least(business_id, 'admin'))
  with check (can_at_least(business_id, 'admin'));

-- Los eventos se escriben con service_role desde /api/public/track y se leen
-- solo desde el panel.
create policy analitica_equipo on analytics_events
  for select using (can_at_least(business_id, 'viewer'));

-- ============================================================================
--  PERMISOS DE TABLA
-- ----------------------------------------------------------------------------
--  RLS filtra filas, pero el GRANT decide si el rol puede siquiera intentarlo.
--  Cinturón y tirantes: al público se le quita todo lo que no sea leer.
-- ============================================================================

revoke all on all tables in schema public from anon, authenticated;

grant select on
  businesses, business_settings, business_templates,
  menu_categories, menu_items, menu_item_allergens, menu_item_extras,
  daily_menus, daily_menu_items, special_menus, events, promotions, faqs,
  legal_text_versions
to anon, authenticated;

-- El panel escribe como usuario autenticado; RLS decide qué negocio.
grant select, insert, update, delete on
  business_members, business_settings, menu_categories, menu_items,
  menu_item_allergens, menu_item_extras, daily_menus, daily_menu_items,
  special_menus, events, promotions, faqs, ai_knowledge_entries,
  legal_text_versions, reservations, group_requests, leads, feedback, qr_codes
to authenticated;

grant select on subscriptions, trial_settings, consent_records, analytics_events to authenticated;
grant update on businesses, profiles to authenticated;
grant usage, select on all sequences in schema public to authenticated;
