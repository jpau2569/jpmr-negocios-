-- ═══════════════════════════════════════════════════════════════════
-- OLVIDO DE PAU AGENDA — esquema para la FASE 2 (cuenta y sincronización)
-- Estado: PROPUESTA. No está aplicado en ningún Supabase ni probado
-- contra uno. La fase 1 (lo que funciona hoy) no lo usa: guarda en el
-- navegador. Se pega en el SQL Editor de Supabase cuando se haga la fase 2.
--
-- Principios:
--  · Cada fila lleva owner_id = auth.uid(). RLS en TODAS las tablas:
--    nadie lee ni escribe filas ajenas, aunque conozca su id.
--  · Borrado = papelera (borrado_en); el purgado a 30 días lo hace una
--    función programada.
--  · Los tokens de Google NO son accesibles desde el navegador: la tabla
--    google_conexiones no tiene políticas para «authenticated»; solo la
--    usa el servidor con la clave de servicio, y el refresh_token va
--    cifrado con una clave que vive en las variables del servidor.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Columnas comunes ------------------------------------------------------
-- id (uuid), owner_id, creado_en, actualizado_en, borrado_en, demo

create table if not exists agenda_clientes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 80),
  apellidos text not null default '' check (char_length(apellidos) <= 120),
  telefono text not null default '' check (char_length(telefono) <= 30),
  email text not null default '' check (char_length(email) <= 120),
  tipo text not null default 'comprador' check (tipo in ('comprador','vendedor','propietario','inquilino','colaborador','otro')),
  estado text not null default 'nuevo' check (estado in ('nuevo','contactado','seguimiento','visita','negociacion','cerrado','archivado')),
  procedencia text not null default '',
  preferencias text not null default '' check (char_length(preferencias) <= 2000),
  presupuesto_min numeric(12,2) check (presupuesto_min >= 0),
  presupuesto_max numeric(12,2) check (presupuesto_max >= 0),
  zonas text not null default '',
  etiquetas text[] not null default '{}',
  proxima_accion text not null default '',
  siguiente_seguimiento date,
  notas text not null default '' check (char_length(notas) <= 4000),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  borrado_en timestamptz,
  demo boolean not null default false,
  check (presupuesto_min is null or presupuesto_max is null or presupuesto_min <= presupuesto_max)
);

create table if not exists agenda_interacciones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  cliente_id uuid not null references agenda_clientes on delete cascade,
  fecha date not null,
  hora time,
  tipo text not null check (tipo in ('llamada','whatsapp','email','visita','reunion','nota')),
  texto text not null default '' check (char_length(texto) <= 1000),
  creado_en timestamptz not null default now()
);

create table if not exists agenda_inmuebles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  referencia text not null default '',
  titulo text not null default '',
  tipo text not null default 'piso',
  operacion text not null default 'venta' check (operacion in ('venta','alquiler')),
  estado_comercial text not null default 'disponible' check (estado_comercial in ('captacion','disponible','reservado','vendido','alquilado','retirado')),
  precio numeric(12,2) check (precio >= 0),
  zona text not null default '',
  superficie numeric(10,2), habitaciones smallint, banos smallint,
  caracteristicas text[] not null default '{}',
  descripcion text not null default '',
  enlaces jsonb not null default '[]', videos jsonb not null default '[]',
  -- Privado: nunca sale en la ficha para compartir.
  direccion text not null default '',
  propietario_id uuid references agenda_clientes on delete set null,
  notas_internas text not null default '',
  proxima_accion text not null default '',
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  borrado_en timestamptz, demo boolean not null default false
);
create unique index if not exists agenda_inmuebles_ref on agenda_inmuebles (owner_id, lower(referencia)) where referencia <> '' and borrado_en is null;

create table if not exists agenda_cliente_inmueble (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  cliente_id uuid not null references agenda_clientes on delete cascade,
  inmueble_id uuid not null references agenda_inmuebles on delete cascade,
  primary key (cliente_id, inmueble_id)
);

create table if not exists agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 140),
  tipo text not null check (tipo in ('personal','reunion','llamada','visita','firma','seguimiento','recordatorio')),
  -- Hora de pared + zona: así el cambio de hora no mueve la cita.
  fecha date not null, fecha_fin date, todo_el_dia boolean not null default false,
  inicio time, fin time, zona_horaria text not null default 'Europe/Madrid',
  ubicacion text not null default '', descripcion text not null default '',
  cliente_id uuid references agenda_clientes on delete set null,
  inmueble_id uuid references agenda_inmuebles on delete set null,
  enlaces jsonb not null default '[]', color text, recordatorios int[] not null default '{}',
  estado_visita text not null default 'pendiente' check (estado_visita in ('pendiente','realizada','cancelada')),
  -- Sincronización con Google: evita duplicados y detecta conflictos.
  google_calendar_id text, google_event_id text, google_etag text, google_actualizado timestamptz,
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  borrado_en timestamptz, demo boolean not null default false,
  check (todo_el_dia or inicio is not null)
);
create unique index if not exists agenda_eventos_google on agenda_eventos (owner_id, google_calendar_id, google_event_id) where google_event_id is not null;

create table if not exists agenda_tareas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 160),
  descripcion text not null default '',
  prioridad text not null default 'media' check (prioridad in ('alta','media','baja')),
  fecha date, hora time,
  estado text not null default 'pendiente' check (estado in ('pendiente','curso','hecha')),
  completada_en timestamptz,
  subtareas jsonb not null default '[]', etiquetas text[] not null default '{}',
  repeticion text not null default '' check (repeticion in ('','diaria','semanal','mensual')),
  cliente_id uuid references agenda_clientes on delete set null,
  inmueble_id uuid references agenda_inmuebles on delete set null,
  enlaces jsonb not null default '[]',
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  borrado_en timestamptz, demo boolean not null default false
);

create table if not exists agenda_notas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  titulo text not null default '', texto text not null default '' check (char_length(texto) <= 20000),
  etiquetas text[] not null default '{}', fijada boolean not null default false,
  cliente_id uuid references agenda_clientes on delete set null,
  inmueble_id uuid references agenda_inmuebles on delete set null,
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  borrado_en timestamptz, demo boolean not null default false
);

create table if not exists agenda_recursos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  titulo text not null default '', url text check (url is null or url ~* '^https?://'),
  archivo_ruta text, -- objeto en el bucket privado «agenda-archivos»
  tipo text not null default 'web', descripcion text not null default '',
  etiquetas text[] not null default '{}', coleccion text not null default '',
  favorito boolean not null default false,
  estado text not null default 'pendiente' check (estado in ('pendiente','revisado','archivado')),
  cliente_id uuid references agenda_clientes on delete set null,
  inmueble_id uuid references agenda_inmuebles on delete set null,
  tarea_id uuid references agenda_tareas on delete set null,
  evento_id uuid references agenda_eventos on delete set null,
  creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(),
  borrado_en timestamptz, demo boolean not null default false
);

-- Solo el servidor (clave de servicio). Sin políticas para usuarios.
create table if not exists agenda_google_conexiones (
  owner_id uuid primary key references auth.users on delete cascade,
  calendario_id text,
  refresh_token_cifrado bytea not null,
  alcance text not null,
  sync_token text,
  ultima_sincronizacion timestamptz,
  ultimo_error text,
  creado_en timestamptz not null default now()
);

-- RLS --------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['agenda_clientes','agenda_interacciones','agenda_inmuebles','agenda_cliente_inmueble','agenda_eventos','agenda_tareas','agenda_notas','agenda_recursos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists propio on %I', t);
    execute format('create policy propio on %I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;
alter table agenda_google_conexiones enable row level security; -- sin políticas: nadie desde el navegador

-- Archivos privados: bucket «agenda-archivos», cada usuario en su carpeta <uid>/...
insert into storage.buckets (id, name, public) values ('agenda-archivos', 'agenda-archivos', false) on conflict (id) do nothing;
drop policy if exists agenda_archivos_propios on storage.objects;
create policy agenda_archivos_propios on storage.objects for all to authenticated
  using (bucket_id = 'agenda-archivos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'agenda-archivos' and (storage.foldername(name))[1] = auth.uid()::text);
