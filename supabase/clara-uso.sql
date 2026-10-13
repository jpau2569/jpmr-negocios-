-- ============================================================================
--  CLARA — contador de gasto de la API de Claude (tabla clara_uso)
-- ----------------------------------------------------------------------------
--  Cómo usarlo (una sola vez):
--    1. Supabase → tu proyecto de la memoria de Clara (clara-memoria).
--    2. SQL Editor → New query → pega este archivo ENTERO → Run.
--    3. Listo. No hay que tocar Vercel: Clara lo detecta sola. Si la tabla no
--       existe, Clara sigue funcionando y el contador se queda en cada
--       dispositivo (localStorage).
--  Se puede volver a ejecutar sin romper nada (idempotente).
--
--  SEGURIDAD — el mismo blindaje que la memoria:
--   · RLS activado y SIN políticas: nadie lee ni escribe la tabla directamente.
--   · Solo se entra por funciones `security definer` con search_path fijo.
--   · Escribir (clara_uso_suma) y leer el detalle (clara_uso_lee) exigen la
--     clave de sincronización de Pau. Se comprueba llamando a la propia
--     clara_memoria_lee(clave), que ya la valida y lanza «clave de
--     sincronización incorrecta» si no vale: así no se copia aquí ni el
--     secreto ni su forma de guardarlo.
--   · clara_uso_resumen(mes) NO pide clave y devuelve solo dos cifras del mes
--     (coste estimado y número de llamadas), sin datos personales. La usan el
--     chequeo /api/clara?estado=1 y el tope mensual (que tiene que valer
--     también en un dispositivo sin clave). Si prefieres que tampoco se vea,
--     ejecuta al final:
--       revoke execute on function public.clara_uso_resumen(text) from anon, authenticated;
--     (entonces el tope solo se aplicará en los dispositivos con clave y el
--     chequeo de estado no enseñará el total).
--   · Cada suma está acotada (sin negativos, máximos por llamada) para que un
--     error no dispare el contador.
-- ============================================================================

create table if not exists public.clara_uso (
  mes                  text primary key check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  entrada              bigint not null default 0,   -- tokens de entrada
  salida               bigint not null default 0,   -- tokens de salida
  cache_lectura        bigint not null default 0,   -- cache_read_input_tokens
  cache_escritura      bigint not null default 0,   -- cache_creation_input_tokens
  llamadas             integer not null default 0,  -- llamadas a la API de Claude
  llamadas_openrouter  integer not null default 0,  -- segunda_opinion
  tokens_openrouter    bigint not null default 0,
  ejecuciones_codigo   integer not null default 0,  -- server_tool_use.code_execution_requests
  llamadas_sin_precio  integer not null default 0,  -- modelo sin precio verificado
  coste_usd            numeric(14,6) not null default 0, -- estimado, en dólares
  actualizado          timestamptz not null default now()
);

alter table public.clara_uso enable row level security;
-- Sin políticas: con RLS activado, eso bloquea todo acceso directo.
revoke all on table public.clara_uso from anon, authenticated;

-- ---------------------------------------------------------------------------
--  Suma el uso de una respuesta al mes. Devuelve la fila del mes.
-- ---------------------------------------------------------------------------
create or replace function public.clara_uso_suma(clave text, mes_uso text, uso jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.clara_uso;
  -- Lee un número del json, sin negativos y con un máximo por llamada.
  n_entrada  bigint  := least(greatest(coalesce((uso->>'entrada')::numeric, 0), 0), 50000000)::bigint;
  n_salida   bigint  := least(greatest(coalesce((uso->>'salida')::numeric, 0), 0), 50000000)::bigint;
  n_lectura  bigint  := least(greatest(coalesce((uso->>'cache_lectura')::numeric, 0), 0), 50000000)::bigint;
  n_escrit   bigint  := least(greatest(coalesce((uso->>'cache_escritura')::numeric, 0), 0), 50000000)::bigint;
  n_llam     integer := least(greatest(coalesce((uso->>'llamadas')::numeric, 0), 0), 1000)::integer;
  n_or_llam  integer := least(greatest(coalesce((uso->>'llamadas_openrouter')::numeric, 0), 0), 1000)::integer;
  n_or_tok   bigint  := least(greatest(coalesce((uso->>'tokens_openrouter')::numeric, 0), 0), 50000000)::bigint;
  n_codigo   integer := least(greatest(coalesce((uso->>'ejecuciones_codigo')::numeric, 0), 0), 1000)::integer;
  n_sinprec  integer := least(greatest(coalesce((uso->>'llamadas_sin_precio')::numeric, 0), 0), 1000)::integer;
  n_coste    numeric := least(greatest(coalesce((uso->>'coste_usd')::numeric, 0), 0), 50);
begin
  -- La misma comprobación de la clave que la memoria (lanza si es incorrecta).
  perform public.clara_memoria_lee(clave);

  if mes_uso is null or mes_uso !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'mes no válido';
  end if;
  if uso is null or jsonb_typeof(uso) <> 'object' then
    raise exception 'uso no válido';
  end if;

  insert into public.clara_uso as u (
    mes, entrada, salida, cache_lectura, cache_escritura, llamadas,
    llamadas_openrouter, tokens_openrouter, ejecuciones_codigo, llamadas_sin_precio, coste_usd, actualizado
  ) values (
    mes_uso, n_entrada, n_salida, n_lectura, n_escrit, n_llam,
    n_or_llam, n_or_tok, n_codigo, n_sinprec, n_coste, now()
  )
  on conflict (mes) do update set
    entrada             = u.entrada + excluded.entrada,
    salida              = u.salida + excluded.salida,
    cache_lectura       = u.cache_lectura + excluded.cache_lectura,
    cache_escritura     = u.cache_escritura + excluded.cache_escritura,
    llamadas            = u.llamadas + excluded.llamadas,
    llamadas_openrouter = u.llamadas_openrouter + excluded.llamadas_openrouter,
    tokens_openrouter   = u.tokens_openrouter + excluded.tokens_openrouter,
    ejecuciones_codigo  = u.ejecuciones_codigo + excluded.ejecuciones_codigo,
    llamadas_sin_precio = u.llamadas_sin_precio + excluded.llamadas_sin_precio,
    coste_usd           = u.coste_usd + excluded.coste_usd,
    actualizado         = now()
  returning * into fila;

  return to_jsonb(fila);
end;
$$;

-- ---------------------------------------------------------------------------
--  Detalle del mes (todos los contadores), con la clave de sincronización.
-- ---------------------------------------------------------------------------
create or replace function public.clara_uso_lee(clave text, mes_uso text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fila public.clara_uso;
begin
  perform public.clara_memoria_lee(clave);
  select * into fila from public.clara_uso where mes = mes_uso;
  if not found then
    return jsonb_build_object('mes', mes_uso, 'coste_usd', 0, 'llamadas', 0);
  end if;
  return to_jsonb(fila);
end;
$$;

-- ---------------------------------------------------------------------------
--  Total del mes sin clave: solo coste estimado y llamadas (ver SEGURIDAD).
-- ---------------------------------------------------------------------------
create or replace function public.clara_uso_resumen(mes_uso text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'mes', mes_uso,
    'coste_usd', coalesce((select coste_usd from public.clara_uso where mes = mes_uso), 0),
    'llamadas', coalesce((select llamadas from public.clara_uso where mes = mes_uso), 0)
  );
$$;

revoke all on function public.clara_uso_suma(text, text, jsonb) from public;
revoke all on function public.clara_uso_lee(text, text) from public;
revoke all on function public.clara_uso_resumen(text) from public;
grant execute on function public.clara_uso_suma(text, text, jsonb) to anon, authenticated;
grant execute on function public.clara_uso_lee(text, text) to anon, authenticated;
grant execute on function public.clara_uso_resumen(text) to anon, authenticated;
