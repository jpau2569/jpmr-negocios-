-- ============================================================================
--  PULSO LOCAL AI — pruebas de aislamiento (RLS)
-- ----------------------------------------------------------------------------
--  El multi-tenant no es una promesa comercial: o se demuestra, o no existe.
--  Este archivo comprueba contra un Postgres real que:
--    · el público lee la carta publicada de un negocio vigente
--    · el público NO alcanza un solo dato personal
--    · el público NO ve nada de un negocio con la demo caducada
--    · un miembro del negocio A no ve nada del negocio B
--
--  Uso:  psql -d <base> -f sql/99_pruebas_rls.sql
--  Cualquier comprobación que falle detiene la ejecución con un error.
--
--  Nota sobre "permiso denegado": para las tablas de datos personales el
--  público se queda fuera DOS VECES — primero por el GRANT (02_rls.sql revoca
--  todo a anon) y después por RLS. Que salte el primero es lo correcto: no
--  llega ni a evaluarse la política.
-- ============================================================================

\set ON_ERROR_STOP on
\set QUIET on
-- Los resultados no interesan; lo que se lee son los avisos de cada assert.
\o /dev/null

create or replace function assert(condicion boolean, descripcion text)
returns void language plpgsql as $$
begin
  if condicion then
    raise notice '  OK      %', descripcion;
  else
    raise exception 'FALLA: %', descripcion;
  end if;
end $$;

-- Para lo que el público no debe alcanzar: vale que RLS devuelva 0 filas o
-- que el GRANT lo corte antes. Lo que NO vale es que devuelva datos.
create or replace function assert_sin_datos(consulta text, descripcion text)
returns void language plpgsql as $$
declare n bigint;
begin
  execute consulta into n;
  if n = 0 then
    raise notice '  OK      % (0 filas)', descripcion;
  else
    raise exception 'FALLA: % — ha devuelto % filas', descripcion, n;
  end if;
exception when insufficient_privilege then
  raise notice '  OK      % (permiso denegado antes de RLS)', descripcion;
end $$;

-- --- Actores de prueba -------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'duena.taberna@ejemplo.test'),
  ('22222222-2222-4222-8222-222222222222', 'dueno.vina@ejemplo.test')
on conflict do nothing;

insert into business_members (business_id, profile_id, role)
select b.id, '11111111-1111-4111-8111-111111111111', 'owner'
  from businesses b where b.slug = 'thewhitebar-mieres'
on conflict do nothing;

insert into business_members (business_id, profile_id, role)
select b.id, '22222222-2222-4222-8222-222222222222', 'owner'
  from businesses b where b.slug = 'la-vina-cenera'
on conflict do nothing;

-- Un dato personal en cada negocio, para comprobar que no se filtra.
delete from reservations; delete from feedback;
insert into reservations (business_id, name, phone, service_date, service_time, party_size)
select b.id, 'Cliente de prueba', '600000000', current_date, '21:00', 4
  from businesses b where b.slug = 'thewhitebar-mieres';
insert into feedback (business_id, rating, comment)
select b.id, 2, 'Comentario privado de prueba'
  from businesses b where b.slug = 'thewhitebar-mieres';

\echo ''
\echo '=== 1. EL PÚBLICO (rol anon) ==='
set role anon;

select assert((select count(*) from menu_items i join businesses b on b.id = i.business_id
               where b.slug = 'thewhitebar-mieres') > 30,
  've la carta publicada de La Taberna');

select assert((select count(*) from daily_menus m join businesses b on b.id = m.business_id
               where b.slug = 'thewhitebar-mieres' and m.service_date = current_date) = 1,
  've el menú del día publicado');

select assert((select count(*) from businesses) = 2,
  've los dos negocios vigentes');

select assert((select count(*) from menu_item_allergens) > 0,
  've los alérgenos declarados de los platos visibles');

select assert_sin_datos('select count(*) from reservations',      'NO alcanza las reservas');
select assert_sin_datos('select count(*) from feedback',          'NO alcanza el feedback');
select assert_sin_datos('select count(*) from leads',             'NO alcanza los contactos captados');
select assert_sin_datos('select count(*) from consent_records',   'NO alcanza los consentimientos');
select assert_sin_datos('select count(*) from group_requests',    'NO alcanza las peticiones de grupo');
select assert_sin_datos('select count(*) from qr_codes',          'NO alcanza los QR del negocio');
select assert_sin_datos('select count(*) from analytics_events',  'NO alcanza la analítica');
select assert_sin_datos('select count(*) from ai_knowledge_entries', 'NO alcanza la base del asistente');
select assert_sin_datos('select count(*) from subscriptions',     'NO alcanza lo comercial');

reset role;

\echo ''
\echo '=== 2. DEMO DE 7 DÍAS CADUCADA ==='

update businesses set status = 'expired', trial_ends_at = now() - interval '1 day'
where slug = 'thewhitebar-mieres';

set role anon;
select assert((select count(*) from menu_items i join businesses b on b.id = i.business_id
               where b.slug = 'thewhitebar-mieres') = 0,
  'caducada la demo, el público NO ve la carta');
select assert((select count(*) from businesses where slug = 'thewhitebar-mieres') = 0,
  'caducada la demo, el negocio no aparece');
select assert((select count(*) from businesses where slug = 'la-vina-cenera') = 1,
  'pero el otro negocio sigue visible');
reset role;

update businesses set status = 'trial', trial_ends_at = now() + interval '7 days'
where slug = 'thewhitebar-mieres';

set role anon;
select assert((select count(*) from businesses where slug = 'thewhitebar-mieres') = 1,
  'reactivado el trial, el negocio vuelve a verse');
reset role;

\echo ''
\echo '=== 3. AISLAMIENTO ENTRE NEGOCIOS ==='

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select assert((select count(*) from reservations) = 1,
  'la dueña de La Taberna ve SU reserva');
select assert((select count(*) from feedback) = 1,
  'la dueña de La Taberna ve SU feedback');
select assert((select count(*) from qr_codes) = 5,
  'la dueña de La Taberna ve SUS 5 QR');
select assert((select count(*) from qr_codes q join businesses b on b.id = q.business_id
               where b.slug = 'la-vina-cenera') = 0,
  'la dueña de La Taberna NO ve los QR de La Viña');

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select assert((select count(*) from reservations) = 0,
  'el dueño de La Viña NO ve las reservas de La Taberna');
select assert((select count(*) from feedback) = 0,
  'el dueño de La Viña NO ve el feedback de La Taberna');
select assert((select count(*) from qr_codes) = 4,
  'el dueño de La Viña ve SOLO sus 4 QR');
select assert((select count(*) from businesses b
               where b.slug = 'thewhitebar-mieres'
                 and can_at_least(b.id, 'staff')) = 0,
  'el dueño de La Viña NO tiene permiso de edición sobre La Taberna');

reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== 4. HONESTIDAD DEL CONTENIDO ==='

select assert((select count(*) from menu_items i join businesses b on b.id = i.business_id
               where b.slug = 'thewhitebar-mieres' and i.is_demo) = 30,
  'los 30 platos sin confirmar están marcados is_demo');
select assert((select count(*) from menu_items i join businesses b on b.id = i.business_id
               where b.slug = 'thewhitebar-mieres' and not i.is_demo) = 14,
  'los 14 platos ya confirmados NO están marcados is_demo');
select assert((select count(*) from daily_menus where is_demo) >= 1,
  'el menú del día de muestra está marcado como muestra');
select assert((select count(*) from business_settings where review_url is not null) = 0,
  'ninguna review_url inventada: sin enlace oficial, no hay botón de Google');
select assert((select count(*) from business_settings where whatsapp is not null) = 0,
  'ningún WhatsApp inventado: sin número, no hay botón');

\o
\echo ''
\echo '=== TODAS LAS COMPROBACIONES PASAN ==='
