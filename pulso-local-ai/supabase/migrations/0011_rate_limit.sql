-- ============================================================================
--  PULSO LOCAL AI — 0011 · Límite de peticiones para formularios públicos
-- ----------------------------------------------------------------------------
--  Un contador en memoria no sirve aquí: en Vercel cada petición puede caer en
--  una instancia distinta, así que el atacante solo tiene que reintentar hasta
--  que le toque una instancia fresca. El cupo vive en la base de datos, que es
--  lo único compartido entre todas las instancias.
--
--  Lo que se guarda es un hash con sal de la IP, nunca la IP: basta para contar
--  y no crea un registro de visitantes.
-- ============================================================================

create table if not exists public.rate_limit_hits (
  clave        text primary key,
  contador     integer not null default 0,
  ventana_inicio timestamptz not null default now()
);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

-- Devuelve true si la petición entra dentro del cupo y lo consume.
create or replace function public.consumir_cupo(
  p_clave text,
  p_limite integer,
  p_ventana_segundos integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fila public.rate_limit_hits%rowtype;
begin
  insert into public.rate_limit_hits (clave, contador, ventana_inicio)
  values (p_clave, 1, now())
  on conflict (clave) do update
    set contador = case
          when public.rate_limit_hits.ventana_inicio < now() - make_interval(secs => p_ventana_segundos)
          then 1
          else public.rate_limit_hits.contador + 1
        end,
        ventana_inicio = case
          when public.rate_limit_hits.ventana_inicio < now() - make_interval(secs => p_ventana_segundos)
          then now()
          else public.rate_limit_hits.ventana_inicio
        end
  returning * into fila;

  return fila.contador <= p_limite;
end;
$$;

-- Limpieza: las filas viejas no aportan nada. Se puede llamar desde el mismo
-- cron que caduca las demos.
create or replace function public.limpiar_rate_limit()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  delete from public.rate_limit_hits where ventana_inicio < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;
