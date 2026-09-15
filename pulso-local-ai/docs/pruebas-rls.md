# Probar el aislamiento multi-tenant de verdad

Los tests automáticos leen el SQL y detectan descuidos. Esto ejecuta las
políticas. **Pásalo antes de meter datos de clientes reales.**

Ejecuta cada bloque en el editor SQL de Supabase (que corre como superusuario) y
fíjate en el resultado esperado de cada uno.

## 0. Preparar dos negocios y dos usuarios

```sql
-- Dos negocios
insert into public.businesses (id, name, slug, status, trial_ends_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Negocio A', 'test-a', 'active', null),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Negocio B', 'test-b', 'active', null)
on conflict (slug) do nothing;

-- Dos usuarios creados antes en Authentication, uno en cada negocio
insert into public.business_members (business_id, user_id, role)
select 'aaaaaaaa-0000-4000-8000-000000000001', id, 'owner'
  from auth.users where email = 'usuario-a@ejemplo.test';

insert into public.business_members (business_id, user_id, role)
select 'bbbbbbbb-0000-4000-8000-000000000002', id, 'owner'
  from auth.users where email = 'usuario-b@ejemplo.test';

-- Un lead en cada uno
insert into public.leads (business_id, lead_type, source, name, phone)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'buyer', 'web', 'Lead de A', '600000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'buyer', 'web', 'Lead de B', '600000002');
```

## 1. Un usuario no ve los datos del otro negocio

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub": "<uuid de usuario-a>", "role": "authenticated"}';

select count(*) from public.leads;
-- ESPERADO: 1 (solo el de A)

select count(*) from public.leads where business_id = 'bbbbbbbb-0000-4000-8000-000000000002';
-- ESPERADO: 0

update public.leads set name = 'secuestrado'
 where business_id = 'bbbbbbbb-0000-4000-8000-000000000002';
-- ESPERADO: UPDATE 0
```

## 2. El público no puede leer tablas, solo vistas

```sql
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select * from public.leads;              -- ESPERADO: permission denied
select * from public.properties;         -- ESPERADO: permission denied
select * from public.consent_records;    -- ESPERADO: permission denied
select count(*) from public.v_negocios_publicos;  -- ESPERADO: funciona
```

## 3. El público no puede escribir

```sql
set local role anon;
insert into public.leads (business_id, lead_type, source, name, phone)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'buyer', 'web', 'Intruso', '600000003');
-- ESPERADO: permission denied for table leads
```

## 4. La dirección privada no sale

```sql
set local role anon;
select * from public.v_inmuebles_publicos limit 1;
-- ESPERADO: la respuesta no incluye ninguna columna private_address
```

## 5. La caducidad de la demo corta el grifo

```sql
update public.businesses
   set status = 'trial', trial_ends_at = now() - interval '1 hour'
 where slug = 'test-a';

set local role anon;
select count(*) from public.v_negocios_publicos where slug = 'test-a';
-- ESPERADO: 0

select count(*) from public.v_inmuebles_publicos
 where business_id = 'aaaaaaaa-0000-4000-8000-000000000001';
-- ESPERADO: 0
```

Y desde la aplicación: `POST /api/publico/contacto` con `businessSlug: "test-a"`
debe responder **410**, no guardar nada, y `/b/test-a` redirigir a
`/trial-expired/test-a`.

## 6. Los roles hacen lo que dicen

Con un usuario `viewer` en el negocio A:

```sql
set local request.jwt.claims = '{"sub": "<uuid del viewer>", "role": "authenticated"}';

select count(*) from public.properties;     -- ESPERADO: ve los inmuebles
insert into public.properties (business_id, slug, title)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'prueba', 'Prueba');
-- ESPERADO: new row violates row-level security policy
```

Con un `agent`: el `insert` funciona, pero `delete` falla (es de `admin`).

## 7. Nadie se asciende a superadministrador

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub": "<uuid de usuario-a>", "role": "authenticated"}';

update public.profiles set is_superadmin = true where id = '<uuid de usuario-a>';
-- ESPERADO: permission denied for column is_superadmin
```

## 8. Las RPC no dejan mirar por la ventana

```sql
set local request.jwt.claims = '{"sub": "<uuid de usuario-a>", "role": "authenticated"}';
select public.resumen_negocio('bbbbbbbb-0000-4000-8000-000000000002');
-- ESPERADO: error «sin_acceso» (42501)

select public.metricas_saas();
-- ESPERADO: error «sin_acceso», salvo que el usuario sea superadministrador
```

## 9. Abuso de formularios

Desde la aplicación, envía siete veces seguidas `POST /api/publico/contacto`:

- Las seis primeras: `200`.
- La séptima: `429` con «Has enviado demasiadas solicitudes seguidas».

Y con el honeypot relleno (`companyWebsite: "x"`): responde `200` pero **no** se
crea ninguna fila en `leads`. Compruébalo con `select count(*) from leads`.

## Limpiar

```sql
delete from public.businesses where slug in ('test-a', 'test-b');
```

(El `on delete cascade` se lleva por delante miembros, leads y consentimientos de
prueba.)
