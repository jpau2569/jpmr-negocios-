#!/bin/bash
# ==========================================================================
#  Probar en el Mac (doble clic): arranca una app en local y, si quieres,
#  abre un link temporal https://….trycloudflare.com para verla en el móvil.
#  - Sin cuenta ni dominio: no usa el plan de Cloudflare de Pau.
#  - Se apaga todo al cerrar esta ventana (o con Ctrl+C).
#  - Cualquiera con el enlace puede entrar: no lo compartas fuera de la prueba.
# ==========================================================================
cd "$(dirname "$0")/.." || exit 1

pausa() { echo; read -r -p "Pulsa Intro para cerrar… " _; }

# --- Node.js 22.13 o superior (las apps de prueba usan node:sqlite) ---------
if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  No encuentro Node.js en este Mac."
  echo "  Instálalo (versión LTS) desde https://nodejs.org y vuelve a abrir este archivo."
  pausa; exit 1
fi
VER="$(node -p 'process.versions.node')"
MAYOR="${VER%%.*}"; RESTO="${VER#*.}"; MENOR="${RESTO%%.*}"
if [ "$MAYOR" -lt 22 ] || { [ "$MAYOR" -eq 22 ] && [ "$MENOR" -lt 13 ]; }; then
  echo
  echo "  Tienes Node.js $VER y hace falta la 22.13 o superior."
  echo "  Instala la versión LTS desde https://nodejs.org y vuelve a abrir este archivo."
  pausa; exit 1
fi

# --- Qué app ----------------------------------------------------------------
echo
echo "  ¿Qué quieres probar?"
echo "    1 = Hojas Firmadas (visitas y captación con firma con el dedo)"
echo "    2 = Valora tu piso y reservas de visitas"
read -r -p "  Escribe 1 o 2 y pulsa Intro: " OPCION
case "$OPCION" in
  1) SCRIPT="cloudflare/hojas-firmadas/herramientas/probar-en-local.mjs"; PUERTO=8790 ;;
  2) SCRIPT="cloudflare/castresana-web/herramientas/probar-en-local.mjs"; PUERTO=8788 ;;
  *) echo "  Opción no válida."; pausa; exit 1 ;;
esac

# --- Arrancar la app ---------------------------------------------------------
node "$SCRIPT" &
APP=$!
TUNEL=""
apagar() { [ -n "$TUNEL" ] && kill "$TUNEL" 2>/dev/null; kill "$APP" 2>/dev/null; }
trap apagar EXIT INT TERM
sleep 2
if ! kill -0 "$APP" 2>/dev/null; then
  echo "  La app no ha arrancado (mira el mensaje de arriba)."
  pausa; exit 1
fi
echo
echo "  ✅ App en marcha en este Mac: http://localhost:$PUERTO"
echo "     (la CLAVE del panel es la que sale arriba)"
open "http://localhost:$PUERTO" 2>/dev/null

# --- Link temporal para el móvil (opcional) ---------------------------------
echo
read -r -p "  ¿Quieres un link temporal para abrirla en el móvil? Escribe S y pulsa Intro (o solo Intro para no): " LINK
if [ "$LINK" = "S" ] || [ "$LINK" = "s" ]; then
  CFD="$(command -v cloudflared || true)"
  if [ -z "$CFD" ] && [ -x "cloudflare/.bin/cloudflared" ]; then CFD="cloudflare/.bin/cloudflared"; fi
  if [ -z "$CFD" ]; then
    if command -v brew >/dev/null 2>&1; then
      echo "  Instalando cloudflared con Homebrew…"
      brew install cloudflared && CFD="$(command -v cloudflared)"
    else
      case "$(uname -m)" in arm64) ARQ=arm64 ;; *) ARQ=amd64 ;; esac
      echo "  Descargando cloudflared oficial de GitHub (Cloudflare) para Mac $ARQ…"
      mkdir -p cloudflare/.bin
      if curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$ARQ.tgz" | tar -xz -C cloudflare/.bin; then
        chmod +x cloudflare/.bin/cloudflared && CFD="cloudflare/.bin/cloudflared"
      fi
    fi
  fi
  if [ -z "$CFD" ]; then
    echo "  No he podido instalar cloudflared. Instálalo desde:"
    echo "    https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/"
  else
    echo
    echo "  Busca abajo una línea con  https://….trycloudflare.com  y ábrela en el móvil."
    echo "  Para APAGARLO TODO: cierra esta ventana (o pulsa Ctrl+C)."
    echo
    "$CFD" tunnel --url "http://127.0.0.1:$PUERTO" &
    TUNEL=$!
  fi
fi

echo
echo "  Todo en marcha. Para apagarlo, cierra esta ventana o pulsa Ctrl+C."
wait "$APP"
