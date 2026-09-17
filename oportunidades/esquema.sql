-- ============================================================================
--  OPORTUNIDADES ÚNICAS — esquema de Supabase
-- ----------------------------------------------------------------------------
--  Cómo usarlo: Supabase → SQL Editor → pegar este archivo entero → Run.
--  Es idempotente: se puede volver a ejecutar sin romper nada.
--
--  SEGURIDAD (el motivo de cada decisión):
--   · RLS activado en todas las tablas. Nadie lee nada sin sesión válida.
--   · El rol vive en `ou_usuarios.rol` y se consulta con una función
--     `security definer` para evitar recursión infinita en las políticas.
--   · Los datos privados (dirección exacta, teléfono del cliente, notas) NUNCA
--     salen por la ficha pública: esa va por la vista `ou_publico`, que solo
--     expone campos comerciales.
--   · El portal del comprador se resuelve en el backend con el token opaco;
--     el navegador del cliente no toca Supabase.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1. Usuarios del despacho (extiende auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.ou_usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text not null,
  rol         text not null default 'agente' check (rol in ('admin', 'agente', 'lector')),
  activo      boolean not null default true,
  creado      timestamptz not null default now()
);

-- Función `security definer`: lee el rol sin pasar por RLS. Sin esto, una
-- política que consulte ou_usuarios para autorizar ou_usuarios se muerde la
-- cola y Postgres devuelve "infinite recursion detected in policy".
create or replace function public.ou_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.ou_usuarios where id = auth.uid() and activo;
$$;

create or replace function public.ou_es_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.ou_rol() in ('admin', 'agente'), false);
$$;

create or replace function public.ou_puede_ver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.ou_rol() in ('admin', 'agente', 'lector'), false);
$$;

-- ---------------------------------------------------------------------------
--  2. Inmuebles
-- ---------------------------------------------------------------------------
create table if not exists public.ou_inmuebles (
  id                uuid primary key default gen_random_uuid(),
  referencia        text unique not null,
  titulo            text not null,
  operacion         text not null default 'venta' check (operacion in ('venta', 'alquiler')),
  precio            numeric(12,2),
  ciudad            text not null,
  zona              text,
  codigo_postal     text,
  provincia         text default 'Asturias',
  -- Dato privado: no se publica jamás. La vista pública no lo incluye.
  direccion_privada text,
  habitaciones      smallint,
  banos             smallint,
  metros            integer,
  caracteristicas   text[] not null default '{}',
  etiquetas         text[] not null default '{}',
  descripcion       text,
  estado            text not null default 'borrador'
                    check (estado in ('borrador', 'disponible', 'enviado', 'reservado', 'vendido', 'archivado')),
  agente_id         uuid references public.ou_usuarios(id) on delete set null,
  publico           boolean not null default false,
  slug              text unique,
  portada_url       text,
  fotos             jsonb not null default '[]',
  creado            timestamptz not null default now(),
  actualizado       timestamptz not null default now()
);

create index if not exists ou_inmuebles_estado_idx on public.ou_inmuebles (estado);
create index if not exists ou_inmuebles_agente_idx on public.ou_inmuebles (agente_id);
create index if not exists ou_inmuebles_slug_idx   on public.ou_inmuebles (slug) where slug is not null;

-- ---------------------------------------------------------------------------
--  3. Clientes
-- ---------------------------------------------------------------------------
create table if not exists public.ou_clientes (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  apellidos              text,
  telefono               text,
  email                  text,
  tipo                   text not null default 'comprador'
                         check (tipo in ('comprador', 'inversor', 'propietario', 'inquilino')),
  operacion              text not null default 'venta' check (operacion in ('venta', 'alquiler')),
  presupuesto_max        numeric(12,2),
  zonas                  text[] not null default '{}',
  habitaciones_min       smallint,
  metros_min             integer,
  necesita               text[] not null default '{}',
  notas                  text,
  agente_id              uuid references public.ou_usuarios(id) on delete set null,
  -- Token opaco del portal privado del comprador. Se genera en el backend.
  token_portal           text unique,
  inmuebles_autorizados  uuid[] not null default '{}',
  -- RGPD: en vez de borrar, se anonimiza y deja de ser localizable.
  anonimizado            boolean not null default false,
  ultimo_contacto        timestamptz,
  creado                 timestamptz not null default now(),
  actualizado            timestamptz not null default now()
);

create index if not exists ou_clientes_agente_idx on public.ou_clientes (agente_id);
create index if not exists ou_clientes_token_idx  on public.ou_clientes (token_portal) where token_portal is not null;

-- ---------------------------------------------------------------------------
--  4. Actividad y tareas
-- ---------------------------------------------------------------------------
create table if not exists public.ou_actividad (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  resumen     text not null,
  inmueble_id uuid references public.ou_inmuebles(id) on delete set null,
  cliente_id  uuid references public.ou_clientes(id) on delete set null,
  autor_id    uuid references public.ou_usuarios(id) on delete set null,
  autor_nombre text,
  creado      timestamptz not null default now()
);

create index if not exists ou_actividad_creado_idx on public.ou_actividad (creado desc);

create table if not exists public.ou_tareas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'hecha', 'descartada')),
  vence       timestamptz,
  inmueble_id uuid references public.ou_inmuebles(id) on delete cascade,
  cliente_id  uuid references public.ou_clientes(id) on delete cascade,
  asignado_a  uuid references public.ou_usuarios(id) on delete set null,
  origen      text not null default 'manual',
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create index if not exists ou_tareas_estado_idx on public.ou_tareas (estado, vence);

-- Respuestas del comprador desde su portal privado.
create table if not exists public.ou_respuestas (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.ou_clientes(id) on delete cascade,
  inmueble_id uuid not null references public.ou_inmuebles(id) on delete cascade,
  respuesta   text not null check (respuesta in ('interesa', 'visita', 'no_encaja', 'similares')),
  creado      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  5. `actualizado` al día sin acordarse de ponerlo a mano
-- ---------------------------------------------------------------------------
create or replace function public.ou_toca_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end;
$$;

drop trigger if exists ou_inmuebles_actualizado on public.ou_inmuebles;
create trigger ou_inmuebles_actualizado before update on public.ou_inmuebles
  for each row execute function public.ou_toca_actualizado();

drop trigger if exists ou_clientes_actualizado on public.ou_clientes;
create trigger ou_clientes_actualizado before update on public.ou_clientes
  for each row execute function public.ou_toca_actualizado();

drop trigger if exists ou_tareas_actualizado on public.ou_tareas;
create trigger ou_tareas_actualizado before update on public.ou_tareas
  for each row execute function public.ou_toca_actualizado();

-- ---------------------------------------------------------------------------
--  6. RLS — quién puede tocar qué
-- ---------------------------------------------------------------------------
alter table public.ou_usuarios   enable row level security;
alter table public.ou_inmuebles  enable row level security;
alter table public.ou_clientes   enable row level security;
alter table public.ou_actividad  enable row level security;
alter table public.ou_tareas     enable row level security;
alter table public.ou_respuestas enable row level security;

-- Usuarios: cada uno se ve a sí mismo; el admin ve y gestiona a todos.
drop policy if exists ou_usuarios_lee on public.ou_usuarios;
create policy ou_usuarios_lee on public.ou_usuarios
  for select using (id = auth.uid() or public.ou_rol() = 'admin');

drop policy if exists ou_usuarios_admin on public.ou_usuarios;
create policy ou_usuarios_admin on public.ou_usuarios
  for all using (public.ou_rol() = 'admin') with check (public.ou_rol() = 'admin');

-- Inmuebles y clientes: los ve todo el despacho; los cambia solo admin/agente.
drop policy if exists ou_inmuebles_lee on public.ou_inmuebles;
create policy ou_inmuebles_lee on public.ou_inmuebles
  for select using (public.ou_puede_ver());

drop policy if exists ou_inmuebles_escribe on public.ou_inmuebles;
create policy ou_inmuebles_escribe on public.ou_inmuebles
  for all using (public.ou_es_staff()) with check (public.ou_es_staff());

drop policy if exists ou_clientes_lee on public.ou_clientes;
create policy ou_clientes_lee on public.ou_clientes
  for select using (public.ou_puede_ver());

drop policy if exists ou_clientes_escribe on public.ou_clientes;
create policy ou_clientes_escribe on public.ou_clientes
  for all using (public.ou_es_staff()) with check (public.ou_es_staff());

-- Actividad: se lee entera, se escribe con sesión de staff, no se reescribe.
drop policy if exists ou_actividad_lee on public.ou_actividad;
create policy ou_actividad_lee on public.ou_actividad
  for select using (public.ou_puede_ver());

drop policy if exists ou_actividad_apunta on public.ou_actividad;
create policy ou_actividad_apunta on public.ou_actividad
  for insert with check (public.ou_es_staff());

drop policy if exists ou_tareas_lee on public.ou_tareas;
create policy ou_tareas_lee on public.ou_tareas
  for select using (public.ou_puede_ver());

drop policy if exists ou_tareas_escribe on public.ou_tareas;
create policy ou_tareas_escribe on public.ou_tareas
  for all using (public.ou_es_staff()) with check (public.ou_es_staff());

drop policy if exists ou_respuestas_lee on public.ou_respuestas;
create policy ou_respuestas_lee on public.ou_respuestas
  for select using (public.ou_puede_ver());

-- Nadie escribe respuestas desde el navegador: las mete el backend por RPC.
-- (Sin política de insert, RLS las bloquea todas.)

-- ---------------------------------------------------------------------------
--  7. Ficha pública — lo único que ve alguien sin sesión
-- ---------------------------------------------------------------------------
--  security_invoker = off: la vista se evalúa con permisos del creador, así
--  que expone SOLO estas columnas de los inmuebles marcados como públicos.
--  La dirección exacta, las notas y el agente no salen de aquí.
create or replace view public.ou_publico
with (security_invoker = off) as
select
  slug, referencia, titulo, operacion, precio, ciudad, zona, provincia,
  habitaciones, banos, metros, caracteristicas, descripcion, portada_url,
  fotos, actualizado
from public.ou_inmuebles
where publico = true and slug is not null and estado in ('disponible', 'reservado');

grant select on public.ou_publico to anon, authenticated;

-- ---------------------------------------------------------------------------
--  8. Portal privado del comprador (token opaco, resuelto en el backend)
-- ---------------------------------------------------------------------------
create or replace function public.ou_portal(token_dado text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c record;
  inmuebles jsonb;
begin
  if token_dado is null or length(token_dado) < 24 then
    return null;
  end if;

  select * into c from public.ou_clientes
   where token_portal = token_dado and not anonimizado;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into inmuebles
    from public.ou_publico p
    join public.ou_inmuebles i on i.slug = p.slug
   where i.id = any (c.inmuebles_autorizados);

  -- Del cliente solo sale el nombre de pila: ni teléfono, ni email, ni notas.
  return jsonb_build_object(
    'cliente', jsonb_build_object('nombre', c.nombre),
    'inmuebles', inmuebles
  );
end;
$$;

-- Registrar la respuesta del comprador y dejar tarea al agente.
create or replace function public.ou_portal_responde(token_dado text, slug_dado text, respuesta_dada text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  inm record;
begin
  select * into c from public.ou_clientes
   where token_portal = token_dado and not anonimizado;
  if not found then return jsonb_build_object('ok', false, 'error', 'enlace no válido'); end if;

  select * into inm from public.ou_inmuebles where slug = slug_dado;
  if not found then return jsonb_build_object('ok', false, 'error', 'inmueble no encontrado'); end if;

  -- Solo puede responder sobre lo que se le ha enseñado.
  if not (inm.id = any (c.inmuebles_autorizados)) then
    return jsonb_build_object('ok', false, 'error', 'no autorizado');
  end if;
  if respuesta_dada not in ('interesa', 'visita', 'no_encaja', 'similares') then
    return jsonb_build_object('ok', false, 'error', 'respuesta no válida');
  end if;

  insert into public.ou_respuestas (cliente_id, inmueble_id, respuesta)
  values (c.id, inm.id, respuesta_dada);

  insert into public.ou_actividad (tipo, resumen, inmueble_id, cliente_id, autor_nombre)
  values ('portal', format('%s respondió "%s" desde su portal', c.nombre, respuesta_dada), inm.id, c.id, c.nombre);

  -- Las respuestas que piden acción humana generan tarea para mañana.
  if respuesta_dada in ('interesa', 'visita') then
    insert into public.ou_tareas (titulo, inmueble_id, cliente_id, asignado_a, origen, vence)
    values (
      case when respuesta_dada = 'visita'
           then format('Llamar a %s: pide visita', c.nombre)
           else format('Seguimiento a %s: le interesa un inmueble', c.nombre) end,
      inm.id, c.id, c.agente_id, 'portal', now() + interval '1 day'
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.ou_portal(text) from public, anon, authenticated;
revoke all on function public.ou_portal_responde(text, text, text) from public, anon, authenticated;
-- Solo el backend (que usa la clave de servicio) puede invocarlas.

-- ---------------------------------------------------------------------------
--  9. Primer administrador
-- ---------------------------------------------------------------------------
--  Después de crear tu usuario en Authentication → Users, ejecuta esto
--  cambiando el correo por el tuyo:
--
--    insert into public.ou_usuarios (id, nombre, email, rol)
--    select id, 'Pau', email, 'admin' from auth.users where email = 'tu@correo.com'
--    on conflict (id) do update set rol = 'admin', activo = true;
--
--  Sin esta fila puedes iniciar sesión, pero no verás ningún dato: el rol es
--  lo que abre las puertas.
-- ============================================================================
