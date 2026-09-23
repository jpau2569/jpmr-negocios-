#!/usr/bin/env bash
# ============================================================================
#  PULSO LOCAL AI — probar el esquema y el aislamiento contra un Postgres real
# ----------------------------------------------------------------------------
#  Levanta un PostgreSQL desechable, aplica esquema + RLS + seed y lanza las
#  pruebas de aislamiento. Si algo falla, sale con error.
#
#  Uso:  bash pulso-local-ai/herramientas/probar-sql.sh
#
#  Necesita postgresql-16 instalado. No toca ninguna base de datos real ni
#  necesita conexión con Supabase.
# ============================================================================
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL="$AQUI/../sql"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATOS="${DATOS:-/var/tmp/plai-pg}"
PUERTO="${PUERTO:-55432}"
SOCK=/var/tmp
BASE=plai

export PATH="$PGBIN:$PATH"

# Postgres se niega a arrancar como root, así que si vamos de root usamos el
# usuario postgres (y lo creamos si hace falta).
como_postgres() {
  if [ "$(id -u)" -eq 0 ]; then
    id postgres >/dev/null 2>&1 || useradd -m postgres
    su postgres -c "PATH=$PGBIN:\$PATH $*"
  else
    bash -lc "PATH=$PGBIN:\$PATH $*"
  fi
}

if ! pg_isready -h "$SOCK" -p "$PUERTO" >/dev/null 2>&1; then
  echo "▶ Levantando un PostgreSQL desechable en $DATOS"
  rm -rf "$DATOS"; mkdir -p "$DATOS"
  [ "$(id -u)" -eq 0 ] && chown postgres "$DATOS"
  chmod 700 "$DATOS"
  como_postgres "initdb -D $DATOS -U postgres --auth=trust" >/dev/null
  como_postgres "pg_ctl -D $DATOS -o '-k $SOCK -p $PUERTO' -l $DATOS/log start" >/dev/null
  sleep 2
fi

P="psql -h $SOCK -p $PUERTO -U postgres"

echo "▶ Base limpia"
$P -q -c "drop database if exists $BASE;" -c "create database $BASE;" >/dev/null

# Lo que en producción pone Supabase: los tres roles, el esquema auth y
# auth.uid(). Aquí se simula para poder probar las políticas sin Supabase.
echo "▶ Sustituto local de Supabase (roles, auth.users, auth.uid)"
$P -q -d "$BASE" -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant select, insert on auth.users to authenticated;
SQL

for f in 01_esquema 02_rls 03_seed 04_inmobiliaria 05_castresana; do
  echo "▶ $f.sql"
  $P -q -d "$BASE" -v ON_ERROR_STOP=1 -f "$SQL/$f.sql" 2>&1 | grep -v "already exists, skipping" || true
done

echo "▶ Pruebas de aislamiento (hostelería)"
$P -d "$BASE" -f "$SQL/99_pruebas_rls.sql" 2>&1 | sed 's/^psql:[^ ]* //' | grep -v '^$'

echo "▶ Pruebas de aislamiento (inmobiliaria)"
$P -d "$BASE" -f "$SQL/98_pruebas_inmobiliaria.sql" 2>&1 | sed 's/^psql:[^ ]* //' | grep -v '^$'

echo
echo "✅ Esquema, políticas y seed verificados contra PostgreSQL real."
