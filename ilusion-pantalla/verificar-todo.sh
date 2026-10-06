#!/usr/bin/env bash
# Ejecuta TODAS las comprobaciones que no necesitan credenciales ni Android SDK. Uso: bash ilusion-pantalla/verificar-todo.sh
set -uo pipefail
cd "$(dirname "$0")"
FALLOS=0; paso() { printf '\n▶ %s\n' "$1"; shift; if "$@"; then echo "  ✔ OK"; else echo "  ✘ FALLÓ"; FALLOS=$((FALLOS+1)); fi; }
paso "Catálogo (40 wallpapers)"                 node content/validar-catalogo.mjs
paso "Seed al día con el catálogo"              bash -c 'node content/generar-seed.mjs >/dev/null && git diff --quiet -- supabase/seed.sql'
paso "Tokens de diseño y contraste WCAG"        node design/verificar-tokens.mjs
paso "Firma R2 (vector AWS) y reglas de acceso" node supabase/tests/r2.test.ts
paso "Validación de eventos de analítica"       node supabase/tests/analitica.test.ts
paso "Premium: estados de Play, JWT, cuenta"    node supabase/tests/play.test.ts
paso "Pipeline de vídeo (ffmpeg real)"          node herramientas/video/tests/video.test.mjs
paso "Migraciones + RLS + analítica + premium"  bash supabase/tests/run.sh
paso "Kotlin puro: rendimiento, catálogo, analítica, cuenta" bash -c 'cd android && gradle --no-daemon -q :core:rendimiento:test :core:catalogo:test :core:analitica:test :core:cuenta:test'
paso "Panel: tipos"                              bash -c 'cd admin && npx tsc --noEmit'
paso "Panel: lint"                               bash -c 'cd admin && npm run lint --silent'
paso "Panel: tests"                              bash -c 'cd admin && npx vitest run --reporter=dot'
paso "Panel: build"                              bash -c 'cd admin && NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=anon npm run build --silent'
echo; if [ "$FALLOS" -eq 0 ]; then echo "✅ TODO VERDE"; else echo "❌ $FALLOS comprobación(es) fallida(s)"; exit 1; fi
echo "No cubierto aquí: compilación de :app/:core:wallpaper (Android SDK), Edge Functions en Deno, y todo lo que exige credenciales reales (Supabase, R2, Play)."
