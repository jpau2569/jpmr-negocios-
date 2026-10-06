-- ILUSIÓN PANTALLA · 0001 · Núcleo V1 (consumo Android)
-- Reglas: RLS en TODAS las tablas; las escrituras sensibles (suscripciones,
-- verificación de compras, métricas agregadas) solo con service_role.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ───────── Tipos ─────────
create type plan_usuario        as enum ('gratis','premium');
create type estado_suscripcion  as enum ('ninguna','activa','en_gracia','pausada','cancelada','expirada');
create type rol_plataforma      as enum ('usuario','editor','admin');
create type estado_publicacion  as enum ('borrador','revision','publicado','pausado','archivado');
create type orientacion_video   as enum ('vertical','horizontal','cuadrado');
create type tipo_wallpaper      as enum ('video','imagen','parallax','escena3d');
create type perfil_rendimiento  as enum ('ahorro','estandar','alta','ultra');
create type accion_historial    as enum ('vista','aplicado','descargado','compartido','eliminado');
create type estado_descarga     as enum ('en_cola','descargando','completada','fallida','cancelada');
create type calidad_video       as enum ('q720','q1080','q1440','q2160');
create type plataforma_dispositivo as enum ('android','ios','macos','windows','web','androidtv','firetv');

-- ───────── Utilidades ─────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────── Perfiles (1:1 con auth.users) ─────────
create table perfiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  nombre                text,
  email                 text,
  avatar_url            text,
  proveedor_auth        text not null default 'email',
  plan                  plan_usuario not null default 'gratis',
  estado_suscripcion    estado_suscripcion not null default 'ninguna',
  rol                   rol_plataforma not null default 'usuario',
  dispositivo_preferido uuid,
  preferencias          jsonb not null default '{}'::jsonb,
  pais                  text,
  idioma                text default 'es',
  borrado_solicitado_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint prefs_objeto check (jsonb_typeof(preferencias) = 'object')
);
create trigger perfiles_updated before update on perfiles for each row execute function set_updated_at();

create or replace function es_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'admin')
$$;
create or replace function es_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol in ('admin','editor'))
$$;

-- Alta automática del perfil al registrarse
create or replace function crear_perfil_nuevo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, email, avatar_url, proveedor_auth)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.email,
          new.raw_user_meta_data->>'avatar_url',
          coalesce(new.raw_app_meta_data->>'provider','email'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function crear_perfil_nuevo();

-- Un usuario NO puede cambiarse a sí mismo plan, estado ni rol.
create or replace function proteger_campos_perfil() returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' and not es_admin() then
    new.plan := old.plan;
    new.estado_suscripcion := old.estado_suscripcion;
    new.rol := old.rol;
  end if;
  return new;
end $$;
create trigger perfiles_proteger before update on perfiles for each row execute function proteger_campos_perfil();

-- ───────── Dispositivos ─────────
create table dispositivos (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid references auth.users(id) on delete cascade,
  instalacion_id    uuid not null unique default gen_random_uuid(),  -- id anónimo estable por instalación
  plataforma        plataforma_dispositivo not null,
  modelo            text,
  version_sistema   text,
  version_app       text,
  capacidades       jsonb not null default '{}'::jsonb,  -- {hevc:true, max_fps:60, ram_mb:6144, wallpaper_lock:true}
  push_token        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on dispositivos (usuario_id);
create trigger dispositivos_updated before update on dispositivos for each row execute function set_updated_at();
alter table perfiles add constraint perfiles_dispositivo_fk foreign key (dispositivo_preferido) references dispositivos(id) on delete set null;

-- ───────── Catálogo ─────────
create table categorias (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  descripcion     text,
  imagen_portada  text,
  orden           int  not null default 0,
  activa          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table wallpapers (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titulo                text not null check (char_length(titulo) between 3 and 80),
  descripcion           text,
  categoria_id          uuid references categorias(id) on delete set null,
  etiquetas             text[] not null default '{}',
  tipo                  tipo_wallpaper not null default 'video',
  orientacion           orientacion_video not null default 'vertical',
  duracion_s            numeric(5,2) check (duracion_s is null or duracion_s between 3 and 60),
  resolucion            text check (resolucion is null or resolucion ~ '^[0-9]{3,4}x[0-9]{3,4}$'),
  fps_recomendado       int  check (fps_recomendado in (24,30,60)),
  perfil_rendimiento    perfil_rendimiento not null default 'estandar',
  tamano_archivo_bytes  bigint check (tamano_archivo_bytes is null or tamano_archivo_bytes > 0),
  consumo_estimado      text,                       -- 'bajo' | 'medio' | 'alto' (informativo)
  color_dominante       text check (color_dominante is null or color_dominante ~ '^#[0-9A-Fa-f]{6}$'),
  estilo                text,
  url_preview           text,                       -- clip corto, baja resolución, público
  url_thumbnail         text,
  url_poster            text,
  es_premium            boolean not null default false,
  destacado_orden       int,                        -- null = no destacado
  estado_publicacion    estado_publicacion not null default 'borrador',
  fecha_publicacion     timestamptz,
  autor_id              uuid references auth.users(id) on delete set null,
  licencia              text not null default 'original-propia',
  creditos              text,
  metricas              jsonb not null default '{"descargas":0,"aplicaciones":0,"favoritos":0}'::jsonb,
  search_vector         tsvector,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint publicado_con_fecha check (estado_publicacion <> 'publicado' or fecha_publicacion is not null)
);
create index wallpapers_publicados_idx on wallpapers (categoria_id, fecha_publicacion desc) where estado_publicacion = 'publicado';
create index wallpapers_search_idx     on wallpapers using gin (search_vector);
create index wallpapers_etiquetas_idx  on wallpapers using gin (etiquetas);
create index wallpapers_titulo_trgm    on wallpapers using gin (titulo gin_trgm_ops);
create trigger wallpapers_updated before update on wallpapers for each row execute function set_updated_at();
create or replace function wallpapers_busqueda() returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('spanish'::regconfig, coalesce(new.titulo,'') || ' ' || coalesce(new.descripcion,'') || ' ' || array_to_string(new.etiquetas,' '));
  return new;
end $$;
create trigger wallpapers_busqueda_t before insert or update of titulo, descripcion, etiquetas on wallpapers for each row execute function wallpapers_busqueda();

-- Archivos de vídeo por calidad. Los de premium NUNCA se exponen por RLS:
-- los entrega la Edge Function `wallpaper-url` con URL firmada tras comprobar derecho.
create table wallpaper_archivos (
  id             uuid primary key default gen_random_uuid(),
  wallpaper_id   uuid not null references wallpapers(id) on delete cascade,
  calidad        calidad_video not null,
  codec          text not null check (codec in ('h264','hevc')),
  fps            int  not null check (fps in (24,30,60)),
  bitrate_kbps   int,
  tamano_bytes   bigint not null check (tamano_bytes > 0 and tamano_bytes <= 157286400),  -- máx. 150 MB
  storage_bucket text not null,
  storage_path   text not null,
  sha256         text,
  created_at     timestamptz not null default now(),
  unique (wallpaper_id, calidad, codec)
);

create table favoritos (
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (usuario_id, wallpaper_id)
);

create table historial (
  id           bigint generated always as identity primary key,
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  accion       accion_historial not null,
  created_at   timestamptz not null default now()
);
create index on historial (usuario_id, created_at desc);

create table descargas (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users(id) on delete cascade,
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  calidad      calidad_video not null,
  tamano_bytes bigint,
  estado       estado_descarga not null default 'en_cola',
  created_at   timestamptz not null default now()
);
create index on descargas (usuario_id, created_at desc);

-- ───────── Suscripciones (solo service_role escribe; el recibo se verifica en backend) ─────────
create table suscripciones (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users(id) on delete cascade,
  plataforma         text not null check (plataforma in ('google_play','app_store','stripe','manual')),
  producto_id        text not null,
  purchase_token_hash text,                      -- hash, nunca el token en claro
  estado             estado_suscripcion not null,
  inicio             timestamptz not null default now(),
  renovacion         timestamptz,
  expiracion         timestamptz,
  recibo_verificado  boolean not null default false,
  ultima_verificacion timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (plataforma, purchase_token_hash)
);
create index on suscripciones (usuario_id, estado);
create trigger suscripciones_updated before update on suscripciones for each row execute function set_updated_at();

-- Derecho a premium = suscripción activa/en gracia, verificada y no vencida.
create or replace function tiene_premium(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from suscripciones
    where usuario_id = uid and recibo_verificado
      and estado in ('activa','en_gracia')
      and (expiracion is null or expiracion > now())
  )
$$;

-- ───────── Analítica de eventos (insert-only para clientes) ─────────
create table eventos_analitica (
  id                  bigint generated always as identity primary key,
  usuario_id          uuid references auth.users(id) on delete set null,
  dispositivo_id      uuid references dispositivos(id) on delete set null,
  evento              text not null check (evento ~ '^[a-z][a-z0-9_]{2,47}$'),
  propiedades_evento  jsonb not null default '{}'::jsonb check (pg_column_size(propiedades_evento) < 4096),
  created_at          timestamptz not null default now()
);
create index on eventos_analitica (evento, created_at desc);
create index on eventos_analitica (created_at desc);

-- ───────── Legal: consentimientos y reportes ─────────
create table consentimientos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid references auth.users(id) on delete cascade,
  instalacion_id uuid,
  finalidad   text not null check (finalidad in ('analitica','personalizacion','publicidad','terminos','privacidad')),
  concedido   boolean not null,
  version_texto text not null,
  created_at  timestamptz not null default now()
);

create table reportes_contenido (
  id           uuid primary key default gen_random_uuid(),
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  usuario_id   uuid references auth.users(id) on delete set null,
  motivo       text not null check (motivo in ('copyright','inapropiado','calidad','otro')),
  comentario   text check (comentario is null or char_length(comentario) <= 1000),
  estado       text not null default 'abierto' check (estado in ('abierto','revisado','descartado','retirado')),
  created_at   timestamptz not null default now()
);

-- ───────── Feature flags (para activar Pro/IA/Marketplace sin republicar la app) ─────────
create table feature_flags (
  clave        text primary key check (clave ~ '^[a-z][a-z0-9_.]{2,63}$'),
  activo       boolean not null default false,
  porcentaje   int not null default 100 check (porcentaje between 0 and 100),
  descripcion  text,
  updated_at   timestamptz not null default now()
);
insert into feature_flags (clave, activo, descripcion) values
 ('v1.crear_basico',        true,  'Creador básico con imagen/vídeo local'),
 ('v1.anuncios_discretos',  false, 'Anuncios discretos (desactivado en V1)'),
 ('pro.inmobiliarias',      false, 'Módulo Ilusión Pantalla Pro'),
 ('studio.ia',              false, 'Ilusión Pantalla Studio (IA generativa)'),
 ('marketplace',            false, 'Marketplace de creadores'),
 ('wallpaper.audio',        false, 'Sonido ambiental opcional'),
 ('wallpaper.parallax',     false, 'Fondos con profundidad y parallax'),
 ('wallpaper.3d',           false, 'Escenas 3D en tiempo real');

-- ───────── Vista pública del catálogo (sin campos internos) ─────────
create view catalogo_publico with (security_invoker = true) as
select w.id, w.slug, w.titulo, w.descripcion, c.slug as categoria_slug, c.nombre as categoria_nombre,
       w.etiquetas, w.tipo, w.orientacion, w.duracion_s, w.resolucion, w.fps_recomendado,
       w.perfil_rendimiento, w.tamano_archivo_bytes, w.consumo_estimado, w.color_dominante, w.estilo,
       w.url_preview, w.url_thumbnail, w.url_poster, w.es_premium, w.destacado_orden,
       w.fecha_publicacion, w.metricas
from wallpapers w left join categorias c on c.id = w.categoria_id
where w.estado_publicacion = 'publicado';

-- ───────── RLS ─────────
alter table perfiles           enable row level security;
alter table dispositivos       enable row level security;
alter table categorias         enable row level security;
alter table wallpapers         enable row level security;
alter table wallpaper_archivos enable row level security;
alter table favoritos          enable row level security;
alter table historial          enable row level security;
alter table descargas          enable row level security;
alter table suscripciones      enable row level security;
alter table eventos_analitica  enable row level security;
alter table consentimientos    enable row level security;
alter table reportes_contenido enable row level security;
alter table feature_flags      enable row level security;

-- perfiles
create policy perfiles_select_propio on perfiles for select using (id = auth.uid() or es_admin());
create policy perfiles_update_propio on perfiles for update using (id = auth.uid() or es_admin()) with check (id = auth.uid() or es_admin());
-- (insert lo hace el trigger; delete en cascada desde auth.users)

-- dispositivos
create policy disp_propios_select on dispositivos for select using (usuario_id = auth.uid());
create policy disp_propios_insert on dispositivos for insert with check (usuario_id = auth.uid());
create policy disp_propios_update on dispositivos for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy disp_propios_delete on dispositivos for delete using (usuario_id = auth.uid());

-- catálogo: lectura pública solo de lo publicado; escritura staff
create policy categorias_lectura on categorias for select using (activa or es_staff());
create policy categorias_staff   on categorias for all using (es_staff()) with check (es_staff());
create policy wallpapers_lectura on wallpapers for select using (estado_publicacion = 'publicado' or es_staff());
create policy wallpapers_staff   on wallpapers for all using (es_staff()) with check (es_staff());
create policy archivos_staff     on wallpaper_archivos for all using (es_staff()) with check (es_staff());
-- Archivos de wallpapers GRATIS y publicados: legibles. Los premium solo vía Edge Function.
create policy archivos_gratis_lectura on wallpaper_archivos for select using (
  exists (select 1 from wallpapers w where w.id = wallpaper_id and w.estado_publicacion = 'publicado' and not w.es_premium)
);

-- datos propios del usuario
create policy fav_propios on favoritos for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy hist_propio_select on historial for select using (usuario_id = auth.uid());
create policy hist_propio_insert on historial for insert with check (usuario_id = auth.uid());
create policy hist_propio_delete on historial for delete using (usuario_id = auth.uid());
create policy desc_propias on descargas for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- suscripciones: el usuario SOLO lee las suyas; nadie escribe salvo service_role (que ignora RLS)
create policy susc_lectura_propia on suscripciones for select using (usuario_id = auth.uid() or es_admin());

-- analítica: los clientes solo insertan; el staff lee
create policy eventos_insert on eventos_analitica for insert with check (usuario_id is null or usuario_id = auth.uid());
create policy eventos_staff_select on eventos_analitica for select using (es_staff());

-- consentimientos y reportes
create policy consent_insert on consentimientos for insert with check (usuario_id is null or usuario_id = auth.uid());
create policy consent_select on consentimientos for select using (usuario_id = auth.uid() or es_admin());
create policy reportes_insert on reportes_contenido for insert with check (usuario_id is null or usuario_id = auth.uid());
create policy reportes_staff on reportes_contenido for select using (es_staff());
create policy reportes_staff_upd on reportes_contenido for update using (es_staff()) with check (es_staff());

-- flags: lectura pública (la app los consulta), escritura admin
create policy flags_lectura on feature_flags for select using (true);
create policy flags_admin on feature_flags for all using (es_admin()) with check (es_admin());

-- ───────── Privilegios ─────────
grant usage on schema public to anon, authenticated, service_role;
grant select on categorias, wallpapers, feature_flags, catalogo_publico, wallpaper_archivos to anon, authenticated;
grant select, insert, update, delete on dispositivos, favoritos, descargas to authenticated;
grant select, insert, delete on historial to authenticated;
grant select, update on perfiles to authenticated;
grant select on suscripciones to authenticated;
grant insert on eventos_analitica, consentimientos, reportes_contenido to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant insert, update, delete on categorias, wallpapers, wallpaper_archivos, feature_flags to authenticated;  -- filtrado por RLS (staff/admin)
grant select, update on reportes_contenido to authenticated;
grant select on eventos_analitica to authenticated;  -- filtrado por RLS (staff)
