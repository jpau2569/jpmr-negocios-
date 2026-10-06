#!/usr/bin/env bash
# Aplica migraciones + tests de RLS en un Postgres temporal. Uso: bash supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
DIR=$(mktemp -d); chmod 777 "$DIR"
trap 'su postgres -c "$PGBIN/pg_ctl -D $DIR/d stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
if [ "$(id -u)" = 0 ]; then RUN="su postgres -c"; else RUN="bash -c"; fi
$RUN "$PGBIN/initdb -D $DIR/d -A trust >/dev/null"
$RUN "$PGBIN/pg_ctl -D $DIR/d -o '-p 54399 -k $DIR' -l $DIR/log -w start >/dev/null"
PSQL="psql -h $DIR -p 54399 -U postgres -v ON_ERROR_STOP=1 -q -d postgres"
$PSQL -f tests/00_stub_supabase.sql
for f in migrations/*.sql; do echo "→ $f"; $PSQL -f "$f"; done
echo "→ tests/10_rls.sql"; $PSQL -f tests/10_rls.sql
echo "→ tests/20_analitica.sql"; $PSQL -f tests/20_analitica.sql
echo "→ tests/30_premium.sql"; $PSQL -f tests/30_premium.sql
echo "→ seed.sql"; $PSQL -f seed.sql
$PSQL -c "do \$\$ begin
  assert (select count(*) from categorias) = 12, 'categorías del seed';
  assert (select count(*) from wallpapers where licencia='original-propia' and estado_publicacion='borrador') >= 40, 'wallpapers del seed';
  assert (select count(*) from wallpapers where destacado_orden is not null and es_premium) = 10, '10 destacados premium';
end \$\$;"
echo "OK: migraciones y RLS verificadas"
