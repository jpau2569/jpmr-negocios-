-- ============================================================================
--  PULSO LOCAL AI — pruebas de aislamiento del sector inmobiliaria
-- ----------------------------------------------------------------------------
--  La promesa comercial de este sector es fuerte: "puedes meter la captación
--  de boca a boca y NO sale en ningún listado ni en Google". Si eso no se
--  demuestra contra un Postgres real, no es una promesa, es un deseo.
--
--  Se comprueba que:
--    · el público ve los inmuebles publicados de un negocio vigente
--    · el público NO ve los de enlace privado, ni conociendo su token
--    · el público NO ve borradores
--    · el público NO alcanza una sola petición de visita
--    · una agencia no ve los inmuebles ni las visitas de otra
--    · las restricciones de precio y certificado energético muerden de verdad
--
--  Se crea su propio decorado, así que no depende del seed de hostelería.
--  Uso:  psql -d <base> -f sql/98_pruebas_inmobiliaria.sql
-- ============================================================================

\set ON_ERROR_STOP on
\set QUIET on
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

-- Falla si la sentencia NO revienta: para comprobar que un CHECK muerde.
create or replace function assert_rechaza(sentencia text, descripcion text)
returns void language plpgsql as $$
begin
  execute sentencia;
  raise exception 'FALLA: % — la base lo ha aceptado y no debia', descripcion;
exception
  when check_violation or not_null_violation or unique_violation then
    raise notice '  OK      % (rechazado por la base)', descripcion;
end $$;

-- --- Decorado: dos agencias, cada una con su gente --------------------------
insert into auth.users (id, email) values
  ('33333333-3333-4333-8333-333333333333', 'pau@castresana.test'),
  ('44444444-4444-4444-8444-444444444444', 'rival@otraagencia.test')
on conflict do nothing;

insert into businesses (id, slug, name, sector, status, trial_ends_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'agencia-a', 'Agencia A', 'inmobiliaria',
   'trial', now() + interval '7 days'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'agencia-b', 'Agencia B', 'inmobiliaria',
   'trial', now() + interval '7 days')
on conflict (slug) do nothing;

insert into business_members (business_id, profile_id, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'owner'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 'owner')
on conflict do nothing;

delete from visit_requests;
delete from properties where business_id in (
  'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002');

-- Agencia A: uno público, uno de boca a boca (enlace privado) y un borrador.
insert into properties
  (business_id, reference, slug, title, operation, kind, price_cents,
   surface_built_m2, municipality, energy_rating, energy_status, status, visibility,
   private_token, source)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'A-001', 'piso-publico',
   'Piso en el centro', 'venta', 'piso', 16500000, 90, 'Oviedo',
   'E', 'disponible', 'published', 'publico', null, 'web'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'A-002', 'chalet-discreto',
   'Chalet que el dueño no quiere anunciar', 'venta', 'chalet', 42000000, 210, 'Mieres',
   null, 'en_tramite', 'published', 'enlace_privado', 'tok-secreto-boca-a-boca', 'manual'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'A-003', 'borrador',
   'Todavia sin repasar', 'venta', 'piso', 9000000, 60, 'Oviedo',
   null, 'pendiente', 'draft', 'borrador', null, 'manual');

-- Agencia B: uno público, para probar que A y B no se ven.
insert into properties
  (business_id, reference, slug, title, operation, kind, price_cents,
   surface_built_m2, municipality, energy_status, status, visibility, source)
values
  ('bbbbbbbb-0000-4000-8000-000000000002', 'B-001', 'piso-de-la-otra',
   'Piso de la agencia rival', 'venta', 'piso', 12000000, 75, 'Gijon',
   'pendiente', 'published', 'publico', 'manual');

-- Un dato personal en cada agencia.
insert into visit_requests (business_id, property_ref, name, phone, preferred_slot)
select id, 'A-001', 'Cliente de A', '600111222', 'tarde'
  from businesses where slug = 'agencia-a';
insert into visit_requests (business_id, property_ref, name, phone, preferred_slot)
select id, 'B-001', 'Cliente de B', '600333444', 'manana'
  from businesses where slug = 'agencia-b';

\echo ''
\echo '=== 1. EL PUBLICO (rol anon) ==='
set role anon;

select assert((select count(*) from properties) = 2,
  've los 2 inmuebles publicos (uno de cada agencia) y nada mas');

select assert((select count(*) from properties where reference = 'A-001') = 1,
  've la ficha publicada de Agencia A');

-- El corazón del sector: el boca a boca no se filtra.
select assert((select count(*) from properties where visibility = 'enlace_privado') = 0,
  'NO ve ningun inmueble de enlace privado');

select assert((select count(*) from properties
               where private_token = 'tok-secreto-boca-a-boca') = 0,
  'NO lo saca NI CONOCIENDO EL TOKEN: RLS no lo expone jamas');

select assert((select count(*) from properties where reference = 'A-002') = 0,
  'NO lo saca ni buscando por su referencia');

select assert((select count(*) from properties where status = 'draft') = 0,
  'NO ve los borradores');

select assert_sin_datos('select count(*) from visit_requests',
  'NO alcanza una sola peticion de visita');

reset role;

\echo ''
\echo '=== 2. DEMO CADUCADA ==='

update businesses set status = 'expired', trial_ends_at = now() - interval '1 day'
where slug = 'agencia-a';

set role anon;
select assert((select count(*) from properties
               where business_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0,
  'caducada la demo, su cartera desaparece del publico');
select assert((select count(*) from properties
               where business_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 1,
  'pero la otra agencia sigue visible');
reset role;

update businesses set status = 'trial', trial_ends_at = now() + interval '7 days'
where slug = 'agencia-a';

\echo ''
\echo '=== 3. AISLAMIENTO ENTRE AGENCIAS ==='

set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';

select assert((select count(*) from properties
               where business_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 3,
  'Agencia A ve SUS 3 inmuebles, privado y borrador incluidos');
select assert((select count(*) from properties where visibility = 'enlace_privado') = 1,
  'Agencia A si ve su inmueble de enlace privado');
-- Un miembro sigue siendo público para las demás agencias: ve su cartera
-- entera y, además, lo que cualquiera vería de las otras. No es una fuga.
select assert((select count(*) from properties) = 4,
  'y ademas el piso publico de la otra agencia, como cualquier visitante');
select assert((select count(*) from visit_requests) = 1,
  'Agencia A ve SU peticion de visita');

set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';

select assert((select count(*) from properties
               where business_id = 'bbbbbbbb-0000-4000-8000-000000000002') = 1,
  'Agencia B ve SU inmueble');
select assert((select count(*) from properties) = 2,
  'y solo el publico de A: ni el privado ni el borrador de la otra agencia');
select assert((select count(*) from properties where reference = 'A-002') = 0,
  'Agencia B NO ve el inmueble discreto de Agencia A');
select assert((select count(*) from visit_requests) = 1,
  'Agencia B ve SOLO su peticion de visita');
select assert((select count(*) from visit_requests where name = 'Cliente de A') = 0,
  'Agencia B NO ve el cliente de Agencia A');

reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== 4. LAS REGLAS DE LA BASE MUERDEN ==='

select assert_rechaza($$
  insert into properties (business_id, reference, slug, title, operation, energy_status,
                          price_on_request, price_cents)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'X-1', 'x1', 'X', 'venta', 'pendiente',
          true, 15000000)$$,
  'no deja "precio a consultar" CON precio a la vez');

select assert_rechaza($$
  insert into properties (business_id, reference, slug, title, operation, energy_status,
                          energy_rating)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'X-2', 'x2', 'X', 'venta', 'disponible',
          null)$$,
  'no deja decir "certificado disponible" sin la letra (RD 390/2021)');

select assert_rechaza($$
  insert into properties (business_id, reference, slug, title, operation, energy_status,
                          visibility, private_token)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'X-3', 'x3', 'X', 'venta', 'pendiente',
          'enlace_privado', null)$$,
  'no deja un enlace privado SIN token (seria inabrible)');

select assert_rechaza($$
  insert into properties (business_id, reference, slug, title, operation, energy_status,
                          visibility, private_token)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'X-4', 'x4', 'X', 'venta', 'pendiente',
          'publico', 'token-suelto')$$,
  'no deja un token en un inmueble publico (no pinta nada)');

select assert_rechaza($$
  insert into properties (business_id, reference, slug, title, operation, energy_status)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'A-001', 'otro-slug', 'Repetida',
          'venta', 'pendiente')$$,
  'no deja repetir referencia dentro de la misma agencia');

select assert((select count(*) from properties p
               join businesses b on b.id = p.business_id
               where b.slug = 'agencia-b' and p.reference = 'B-001') = 1,
  'pero la misma referencia SI puede existir en otra agencia');

\o
\echo ''
\echo '=== TODAS LAS COMPROBACIONES DEL SECTOR INMOBILIARIA PASAN ==='
