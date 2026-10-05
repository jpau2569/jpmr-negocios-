-- ILUSIÓN PANTALLA · 0002 · Módulo PRO (inmobiliarias, escaparates, pantallas)
-- Aislado de la V1: ninguna tabla del núcleo depende de estas. Activo tras el flag `pro.inmobiliarias`.

create type rol_empresa as enum ('propietario','administrador','agente','editor','visualizador');
create type tipo_operacion as enum ('venta','alquiler','alquiler_opcion_compra','traspaso');
create type estado_propiedad as enum ('borrador','activa','reservada','vendida','alquilada','retirada');
create type tipo_activo as enum ('imagen','video','logo','pdf','ficha','audio','tour');
create type estado_pantalla as enum ('pendiente_emparejar','activa','offline','pausada','retirada');
create type estado_campana as enum ('borrador','programada','activa','pausada','finalizada');
create type destino_qr as enum ('ficha','whatsapp','telefono','formulario','url');

create table empresas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  cif           text,
  logo_url      text,
  marca         jsonb not null default '{}'::jsonb,   -- {colores:{}, tipografia:'', tono:''}
  contacto      jsonb not null default '{}'::jsonb,   -- {telefono, whatsapp, email, web}
  plan_pro      text not null default 'prueba' check (plan_pro in ('prueba','basico','profesional','agencia')),
  limites       jsonb not null default '{"pantallas":2,"almacenamiento_mb":2048,"usuarios":3}'::jsonb,
  creada_por    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger empresas_updated before update on empresas for each row execute function set_updated_at();

create table miembros_empresa (
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol        rol_empresa not null,
  invitado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (empresa_id, usuario_id)
);
create index on miembros_empresa (usuario_id);

create table equipos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);
create table equipo_miembros (
  equipo_id uuid not null references equipos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  primary key (equipo_id, usuario_id)
);

create table sedes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  direccion text,
  ciudad text,
  zona_horaria text not null default 'Europe/Madrid',
  created_at timestamptz not null default now()
);
create index on sedes (empresa_id);

create table activos_multimedia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo tipo_activo not null,
  nombre text not null,
  mime text not null check (mime in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime','application/pdf','audio/mpeg','audio/mp4')),
  tamano_bytes bigint not null check (tamano_bytes > 0 and tamano_bytes <= 524288000),  -- 500 MB
  ancho int, alto int, duracion_s numeric(7,2),
  storage_path text not null,
  sha256 text,
  origen text not null default 'subida' check (origen in ('subida','ia','plantilla','feed')),
  subido_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on activos_multimedia (empresa_id, tipo);

create table propiedades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  sede_id uuid references sedes(id) on delete set null,
  referencia text not null,
  operacion tipo_operacion not null,
  estado estado_propiedad not null default 'borrador',
  titulo text not null,
  descripcion text,
  precio_eur numeric(12,2) check (precio_eur is null or precio_eur >= 0),
  superficie_m2 numeric(8,2), habitaciones int, banos int,
  direccion text, ciudad text, zona text, lat double precision, lng double precision,
  caracteristicas jsonb not null default '{}'::jsonb,   -- solo datos reales cargados por la agencia
  url_ficha text,
  feed_origen text,                                      -- 'manual' | 'crm:<nombre>' | 'xml'
  feed_id_externo text,
  activo_portada uuid references activos_multimedia(id) on delete set null,
  agente_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, referencia)
);
create index on propiedades (empresa_id, estado);
create trigger propiedades_updated before update on propiedades for each row execute function set_updated_at();

create table propiedad_activos (
  propiedad_id uuid not null references propiedades(id) on delete cascade,
  activo_id uuid not null references activos_multimedia(id) on delete cascade,
  orden int not null default 0,
  primary key (propiedad_id, activo_id)
);

create table plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade,   -- null = plantilla de la plataforma
  nombre text not null,
  formato text not null check (formato in ('vertical_9_16','horizontal_16_9','cuadrado_1_1')),
  tipo text not null default 'propiedad' check (tipo in ('propiedad','promocion','testimonio','servicio','bienvenida')),
  definicion jsonb not null,             -- capas, zonas de texto, posición de QR y logo
  publica boolean not null default false,
  created_at timestamptz not null default now()
);

create table playlists (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  formato text not null default 'vertical_9_16' check (formato in ('vertical_9_16','horizontal_16_9','cuadrado_1_1')),
  created_at timestamptz not null default now()
);
create table playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references playlists(id) on delete cascade,
  orden int not null,
  propiedad_id uuid references propiedades(id) on delete cascade,
  activo_id uuid references activos_multimedia(id) on delete cascade,
  plantilla_id uuid references plantillas(id) on delete set null,
  duracion_s int not null default 10 check (duracion_s between 3 and 300),
  cta jsonb not null default '{}'::jsonb,
  check (propiedad_id is not null or activo_id is not null)
);
create index on playlist_items (playlist_id, orden);

create table pantallas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  sede_id uuid references sedes(id) on delete set null,
  nombre text not null,
  orientacion orientacion_video not null default 'vertical',
  resolucion text,
  estado estado_pantalla not null default 'pendiente_emparejar',
  codigo_emparejamiento text unique,                 -- 8 chars, caduca
  codigo_caduca_at timestamptz,
  token_hash text,                                   -- hash del token de dispositivo (nunca en claro)
  ultimo_latido_at timestamptz,
  version_player text,
  created_at timestamptz not null default now()
);
create index on pantallas (empresa_id);

create table dispositivos_pro (
  id uuid primary key default gen_random_uuid(),
  pantalla_id uuid not null references pantallas(id) on delete cascade,
  plataforma plataforma_dispositivo not null,
  modelo text, version_sistema text,
  capacidades jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table campanas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  playlist_id uuid not null references playlists(id) on delete restrict,
  estado estado_campana not null default 'borrador',
  prioridad int not null default 0,
  inicio timestamptz, fin timestamptz,
  horario jsonb not null default '{}'::jsonb,       -- {dias:[1..7], franjas:[{desde:'09:00',hasta:'21:00'}]}
  modo_destacado boolean not null default false,
  created_at timestamptz not null default now(),
  check (fin is null or inicio is null or fin > inicio)
);
create table campana_destinos (
  campana_id uuid not null references campanas(id) on delete cascade,
  pantalla_id uuid references pantallas(id) on delete cascade,
  sede_id uuid references sedes(id) on delete cascade,
  check (pantalla_id is not null or sede_id is not null)
);

create table codigos_qr (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  propiedad_id uuid references propiedades(id) on delete cascade,
  destino destino_qr not null,
  valor text not null,
  slug_corto text not null unique,         -- /q/<slug> redirige y cuenta el escaneo
  created_at timestamptz not null default now()
);
create table qr_escaneos (
  id bigint generated always as identity primary key,
  qr_id uuid not null references codigos_qr(id) on delete cascade,
  pantalla_id uuid references pantallas(id) on delete set null,
  created_at timestamptz not null default now()    -- sin IP ni datos personales
);
create index on qr_escaneos (qr_id, created_at desc);

create table metricas_pro (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  pantalla_id uuid references pantallas(id) on delete set null,
  campana_id uuid references campanas(id) on delete set null,
  propiedad_id uuid references propiedades(id) on delete set null,
  tipo text not null check (tipo in ('reproduccion','qr','latido','error')),
  segundos int,
  created_at timestamptz not null default now()
);
create index on metricas_pro (empresa_id, created_at desc);

create table suscripciones_pro (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  plan text not null,
  proveedor text not null default 'stripe',
  proveedor_ref text,
  estado estado_suscripcion not null,
  inicio timestamptz not null default now(),
  expiracion timestamptz,
  created_at timestamptz not null default now()
);

-- ───────── Permisos ─────────
create or replace function rol_en(emp uuid) returns rol_empresa language sql stable security definer set search_path = public as $$
  select rol from miembros_empresa where empresa_id = emp and usuario_id = auth.uid()
$$;
create or replace function puede_en(emp uuid, roles rol_empresa[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros_empresa where empresa_id = emp and usuario_id = auth.uid() and rol = any(roles))
$$;
-- leer: cualquier miembro · gestionar contenido: propietario/admin/agente/editor · gestionar empresa: propietario/admin
create or replace function pro_lee(emp uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from miembros_empresa where empresa_id = emp and usuario_id = auth.uid())
$$;
create or replace function pro_edita(emp uuid) returns boolean language sql stable as $$
  select puede_en(emp, array['propietario','administrador','agente','editor']::rol_empresa[])
$$;
create or replace function pro_admin(emp uuid) returns boolean language sql stable as $$
  select puede_en(emp, array['propietario','administrador']::rol_empresa[])
$$;

-- Crear empresa: el creador se convierte en propietario (atómico).
create or replace function crear_empresa(p_nombre text, p_slug text) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  insert into empresas (nombre, slug, creada_por) values (p_nombre, p_slug, auth.uid()) returning id into v_id;
  insert into miembros_empresa (empresa_id, usuario_id, rol) values (v_id, auth.uid(), 'propietario');
  return v_id;
end $$;

-- ───────── RLS (tablas con empresa_id directo) ─────────
do $$
declare t text;
begin
  foreach t in array array['sedes','activos_multimedia','propiedades','playlists','pantallas','campanas','codigos_qr','equipos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (pro_lee(empresa_id))', t||'_sel', t);
    execute format('create policy %I on %I for insert with check (pro_edita(empresa_id))', t||'_ins', t);
    execute format('create policy %I on %I for update using (pro_edita(empresa_id)) with check (pro_edita(empresa_id))', t||'_upd', t);
    execute format('create policy %I on %I for delete using (pro_admin(empresa_id))', t||'_del', t);
  end loop;
end $$;

alter table empresas enable row level security;
create policy empresas_sel on empresas for select using (pro_lee(id));
create policy empresas_upd on empresas for update using (pro_admin(id)) with check (pro_admin(id));
-- insert vía crear_empresa(); delete solo propietario
create policy empresas_del on empresas for delete using (puede_en(id, array['propietario']::rol_empresa[]));

alter table miembros_empresa enable row level security;
create policy miembros_sel on miembros_empresa for select using (usuario_id = auth.uid() or pro_lee(empresa_id));
create policy miembros_ins on miembros_empresa for insert with check (pro_admin(empresa_id) and rol <> 'propietario');
create policy miembros_upd on miembros_empresa for update using (pro_admin(empresa_id)) with check (pro_admin(empresa_id) and rol <> 'propietario');
create policy miembros_del on miembros_empresa for delete using (pro_admin(empresa_id) and rol <> 'propietario');

alter table metricas_pro enable row level security;
create policy metricas_sel on metricas_pro for select using (pro_lee(empresa_id));   -- inserción: solo service_role (player)
alter table suscripciones_pro enable row level security;
create policy suscpro_sel on suscripciones_pro for select using (pro_admin(empresa_id));

alter table plantillas enable row level security;
create policy plantillas_sel on plantillas for select using (publica or (empresa_id is not null and pro_lee(empresa_id)) or es_staff());
create policy plantillas_ins on plantillas for insert with check ((empresa_id is not null and pro_edita(empresa_id)) or (empresa_id is null and es_staff()));
create policy plantillas_upd on plantillas for update using ((empresa_id is not null and pro_edita(empresa_id)) or (empresa_id is null and es_staff()));
create policy plantillas_del on plantillas for delete using ((empresa_id is not null and pro_admin(empresa_id)) or (empresa_id is null and es_staff()));

-- tablas hijas: heredan permiso por su padre
alter table equipo_miembros enable row level security;
create policy eqm_all on equipo_miembros for all
  using (exists (select 1 from equipos e where e.id = equipo_id and pro_admin(e.empresa_id)))
  with check (exists (select 1 from equipos e where e.id = equipo_id and pro_admin(e.empresa_id)));
alter table propiedad_activos enable row level security;
create policy pa_sel on propiedad_activos for select using (exists (select 1 from propiedades p where p.id = propiedad_id and pro_lee(p.empresa_id)));
create policy pa_mod on propiedad_activos for all
  using (exists (select 1 from propiedades p where p.id = propiedad_id and pro_edita(p.empresa_id)))
  with check (exists (select 1 from propiedades p where p.id = propiedad_id and pro_edita(p.empresa_id)));
alter table playlist_items enable row level security;
create policy pli_sel on playlist_items for select using (exists (select 1 from playlists p where p.id = playlist_id and pro_lee(p.empresa_id)));
create policy pli_mod on playlist_items for all
  using (exists (select 1 from playlists p where p.id = playlist_id and pro_edita(p.empresa_id)))
  with check (exists (select 1 from playlists p where p.id = playlist_id and pro_edita(p.empresa_id)));
alter table campana_destinos enable row level security;
create policy cd_sel on campana_destinos for select using (exists (select 1 from campanas c where c.id = campana_id and pro_lee(c.empresa_id)));
create policy cd_mod on campana_destinos for all
  using (exists (select 1 from campanas c where c.id = campana_id and pro_edita(c.empresa_id)))
  with check (exists (select 1 from campanas c where c.id = campana_id and pro_edita(c.empresa_id)));
alter table dispositivos_pro enable row level security;
create policy dpro_sel on dispositivos_pro for select using (exists (select 1 from pantallas p where p.id = pantalla_id and pro_lee(p.empresa_id)));
alter table qr_escaneos enable row level security;
create policy qre_sel on qr_escaneos for select using (exists (select 1 from codigos_qr q where q.id = qr_id and pro_lee(q.empresa_id)));  -- insert: service_role (redirector)

-- ───────── Privilegios ─────────
grant select, insert, update, delete on empresas, miembros_empresa, equipos, equipo_miembros, sedes, activos_multimedia,
  propiedades, propiedad_activos, plantillas, playlists, playlist_items, pantallas, campanas, campana_destinos, codigos_qr to authenticated;
grant select on dispositivos_pro, qr_escaneos, metricas_pro, suscripciones_pro to authenticated;
grant execute on function crear_empresa(text,text) to authenticated;
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to authenticated;
