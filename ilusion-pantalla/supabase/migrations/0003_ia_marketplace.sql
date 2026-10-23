-- ILUSIÓN PANTALLA · 0003 · Studio IA + Marketplace (preparado, desactivado por feature flags)

create type estado_trabajo_ia as enum ('en_cola','moderacion','procesando','pendiente_aprobacion','aprobado','rechazado','fallido','cancelado');
create type tipo_trabajo_ia   as enum ('prompt_a_imagen','prompt_a_video','imagen_a_video','parallax','escena_arquitectonica','video_inmobiliario','reencuadre','loop_perfecto','mejora_calidad','copy');

-- Libro de créditos: saldo = suma de movimientos (inmutable, auditable)
create table creditos_ia (
  id bigint generated always as identity primary key,
  usuario_id uuid references auth.users(id) on delete cascade,
  empresa_id uuid references empresas(id) on delete cascade,
  delta int not null,                                -- + recarga / − consumo
  motivo text not null check (motivo in ('compra','suscripcion','regalo','consumo','reembolso','ajuste')),
  trabajo_id uuid,
  created_at timestamptz not null default now(),
  check ((usuario_id is not null) <> (empresa_id is not null))
);
create index on creditos_ia (usuario_id);
create index on creditos_ia (empresa_id);

create table trabajos_ia (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete set null,
  empresa_id uuid references empresas(id) on delete set null,
  tipo tipo_trabajo_ia not null,
  estado estado_trabajo_ia not null default 'en_cola',
  prompt text check (prompt is null or char_length(prompt) <= 2000),
  parametros jsonb not null default '{}'::jsonb,
  proveedor text,
  modelo text,
  coste_creditos int not null default 0 check (coste_creditos >= 0),
  coste_proveedor_eur numeric(10,4),               -- coste real por generación (registro obligatorio)
  moderacion jsonb not null default '{}'::jsonb,   -- veredicto de moderación del prompt y del resultado
  activo_resultado_id uuid references activos_multimedia(id) on delete set null,
  error text,
  aprobado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index on trabajos_ia (usuario_id, created_at desc);
create index on trabajos_ia (estado) where estado in ('en_cola','procesando','moderacion');
alter table creditos_ia add constraint creditos_trabajo_fk foreign key (trabajo_id) references trabajos_ia(id) on delete set null;

create or replace function saldo_creditos(p_usuario uuid, p_empresa uuid) returns int language plpgsql stable security definer set search_path = public as $$
begin
  -- solo el propio usuario, un admin de la empresa o la plataforma pueden consultar un saldo
  if coalesce(auth.role(),'') <> 'service_role' and not es_admin() then
    if p_usuario is not null and p_usuario <> auth.uid() then raise exception 'sin permiso'; end if;
    if p_empresa is not null and not pro_admin(p_empresa) then raise exception 'sin permiso'; end if;
  end if;
  return (select coalesce(sum(delta),0)::int from creditos_ia
          where (p_usuario is not null and usuario_id = p_usuario) or (p_empresa is not null and empresa_id = p_empresa));
end $$;

-- Marketplace
create table marketplace_packs (
  id uuid primary key default gen_random_uuid(),
  creador_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null, descripcion text,
  precio_eur numeric(8,2) not null check (precio_eur >= 0),
  licencia_id uuid,
  estado estado_publicacion not null default 'borrador',
  comision_plataforma numeric(4,3) not null default 0.300 check (comision_plataforma between 0 and 1),
  created_at timestamptz not null default now()
);
create table marketplace_pack_items (
  pack_id uuid not null references marketplace_packs(id) on delete cascade,
  wallpaper_id uuid not null references wallpapers(id) on delete cascade,
  primary key (pack_id, wallpaper_id)
);
create table licencias_contenido (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  uso_comercial boolean not null default false,
  atribucion_requerida boolean not null default true,
  texto_url text,
  created_at timestamptz not null default now()
);
alter table marketplace_packs add constraint packs_licencia_fk foreign key (licencia_id) references licencias_contenido(id);
create table compras_packs (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references marketplace_packs(id) on delete restrict,
  importe_eur numeric(8,2) not null,
  plataforma text not null,
  recibo_verificado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (usuario_id, pack_id)
);
insert into licencias_contenido (nombre, uso_comercial, atribucion_requerida) values
 ('original-propia', true,  false),
 ('personal-no-comercial', false, true),
 ('comercial-con-atribucion', true, true);

alter table creditos_ia enable row level security;
alter table trabajos_ia enable row level security;
alter table marketplace_packs enable row level security;
alter table marketplace_pack_items enable row level security;
alter table licencias_contenido enable row level security;
alter table compras_packs enable row level security;

create policy creditos_sel on creditos_ia for select using (usuario_id = auth.uid() or (empresa_id is not null and pro_admin(empresa_id)) or es_admin());
-- escritura de créditos: solo service_role
create policy trabajos_sel on trabajos_ia for select using (usuario_id = auth.uid() or (empresa_id is not null and pro_lee(empresa_id)) or es_admin());
create policy trabajos_ins on trabajos_ia for insert with check (usuario_id = auth.uid() and estado = 'en_cola' and coste_creditos = 0);
create policy packs_sel on marketplace_packs for select using (estado = 'publicado' or creador_id = auth.uid() or es_staff());
create policy packs_ins on marketplace_packs for insert with check (creador_id = auth.uid() and estado = 'borrador');
create policy packs_upd on marketplace_packs for update using (creador_id = auth.uid() or es_staff()) with check (creador_id = auth.uid() or es_staff());
create policy packitems_sel on marketplace_pack_items for select using (exists (select 1 from marketplace_packs p where p.id = pack_id and (p.estado = 'publicado' or p.creador_id = auth.uid() or es_staff())));
create policy licencias_sel on licencias_contenido for select using (true);
create policy compras_sel on compras_packs for select using (usuario_id = auth.uid() or es_admin());

grant select on creditos_ia, trabajos_ia, marketplace_packs, marketplace_pack_items, licencias_contenido, compras_packs to authenticated;
grant select on licencias_contenido to anon;
grant insert on trabajos_ia to authenticated;
grant insert, update on marketplace_packs to authenticated;
grant execute on function saldo_creditos(uuid, uuid) to authenticated;
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to authenticated;
