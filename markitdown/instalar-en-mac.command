#!/bin/bash
# instalar-en-mac.command — doble clic en el Mac de Pau.
# Deja MarkItDown conectado a Claude Code (todos los proyectos) y, si se quiere,
# a la app de escritorio, y copia la skill «markitdown» a ~/.claude/skills/ para
# que se active sola con PDF, Word, Excel y PowerPoint en cualquier proyecto.
# Reglas: nunca sudo; pregunta antes de instalar nada; no toca lo que ya existe
# sin preguntar; si algo falla, enseña el error tal cual y se para.

set -u
paso() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  ✔ %s\n' "$1"; }
aviso(){ printf '  ⚠ %s\n' "$1"; }
para() { printf '\n  ✘ %s\n\nNo sigo. Cuéntaselo a Clara con el error de arriba.\n' "$1"; read -r -p "Pulsa Intro para cerrar." _; exit 1; }
pregunta() { local r; read -r -p "  $1 [s/n] " r; [[ "$r" =~ ^[sS] ]]; }

export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# 1 ── uv ────────────────────────────────────────────────────────────────────
paso "1. Busco uv (lo que descarga y arranca MarkItDown)"
if command -v uvx >/dev/null 2>&1; then
  ok "uv ya está: $(uvx --version)"
else
  aviso "No tienes uv. Hace falta para MarkItDown."
  if pregunta "¿Lo instalo con el método oficial de docs.astral.sh/uv?"; then
    if command -v brew >/dev/null 2>&1; then
      brew install uv || para "brew install uv ha fallado."
    else
      curl -LsSf https://astral.sh/uv/install.sh | sh || para "El instalador oficial de uv ha fallado."
    fi
    command -v uvx >/dev/null 2>&1 || para "uv se ha instalado pero no encuentro uvx. Cierra la Terminal y vuelve a abrir este archivo."
    ok "uv instalado: $(uvx --version)"
  else
    para "Sin uv no se puede seguir."
  fi
fi
UVX="$(command -v uvx)"

# 2 ── claude ────────────────────────────────────────────────────────────────
paso "2. Busco el comando claude"
if command -v claude >/dev/null 2>&1; then
  CLAUDE="$(command -v claude)"
else
  CLAUDE="$(ls -d "$HOME"/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude 2>/dev/null | sort -V | tail -1)"
fi
[ -n "${CLAUDE:-}" ] && [ -x "$CLAUDE" ] || para "No encuentro claude ni en la Terminal ni en la extensión de VS Code."
ok "claude: $CLAUDE ($("$CLAUDE" --version 2>&1))"

# 3 ── conector en Claude Code ───────────────────────────────────────────────
paso "3. Conecto MarkItDown a Claude Code para todos tus proyectos"
if "$CLAUDE" mcp get markitdown >/dev/null 2>&1; then
  ok "Ya había uno llamado markitdown. No lo toco."
else
  "$CLAUDE" mcp add --scope user --transport stdio markitdown -- uvx markitdown-mcp || para "claude mcp add ha fallado."
  ok "Añadido."
fi

# 4 ── comprobación ──────────────────────────────────────────────────────────
paso "4. Compruebo que conecta (la primera vez descarga el paquete y tarda un poco)"
conectado=no
for intento in 1 2 3; do
  if "$CLAUDE" mcp list 2>&1 | grep -i '^markitdown' | grep -q 'Connected'; then conectado=si; break; fi
  aviso "Aún no conecta (intento $intento de 3). Espero 30 s…"; sleep 30
done
"$CLAUDE" mcp list 2>&1 | grep -i '^markitdown'
[ "$conectado" = si ] && ok "markitdown ✔ Connected" || para "markitdown no sale como Connected."

# 5 ── skill global ──────────────────────────────────────────────────────────
paso "5. Copio la skill a ~/.claude/skills/markitdown (se activa sola en todos los proyectos)"
DESTINO="$HOME/.claude/skills/markitdown"
escribir_skill=si
if [ -f "$DESTINO/SKILL.md" ]; then
  aviso "Ya tienes una skill markitdown."
  if pregunta "¿La sustituyo? (guardo una copia de la tuya al lado)"; then
    cp "$DESTINO/SKILL.md" "$DESTINO/SKILL.md.copia-$(date +%Y%m%d-%H%M%S)"
  else
    escribir_skill=no; ok "La dejo como está."
  fi
fi
if [ "$escribir_skill" = si ]; then
  mkdir -p "$DESTINO"
  cat > "$DESTINO/SKILL.md" <<'SKILL'
---
name: markitdown
description: Usar SIEMPRE que Pau pase, adjunte, nombre o dé la ruta de un PDF, Word (.docx/.doc), Excel (.xlsx/.xls), PowerPoint (.pptx), CSV, EPUB o HTML, o una carpeta con ellos, o un enlace de YouTube que quiera en texto, para leerlo, resumirlo, sacar cifras o contestar preguntas sobre él. Convierte el archivo a Markdown con MarkItDown (Microsoft, MIT) antes de leerlo, para gastar menos y leer bien las tablas.
---

# MarkItDown: convertir antes de leer

Regla de Pau: **todo PDF, Word, Excel o PowerPoint pasa por MarkItDown antes de leerlo.**
No se lee el binario directamente con Read salvo que MarkItDown falle.

## Cómo

1. Con el conector cargado, usa `mcp__markitdown__convert_to_markdown` con la ruta como
   URI: `file:///ruta/absoluta/al/archivo.pdf` (o la URL `https://…`).
2. Si el conector no está cargado en esta sesión, usa el mismo paquete desde la terminal:
   `uvx --from markitdown markitdown "/ruta/al/archivo.pdf" > "/ruta/al/archivo.pdf.md"`
   y lee el `.md`. Para una carpeta, uno por archivo; nunca sobrescribas un `.md` que ya exista.
3. Si `claude mcp list` no muestra markitdown, díselo a Pau y ofrécele conectarlo con
   `claude mcp add --scope user --transport stdio markitdown -- uvx markitdown-mcp`.
   No instales nada sin preguntar. Nunca uses sudo.

## Después de convertir

- Haz lo que Pau pidió (resumen en 5 puntos, cifras, respuesta concreta) sobre el Markdown.
- Si sale vacío o raro (PDF escaneado, fuentes rotas), dilo y ofrece leer el original como
  imagen. No inventes lo que falte.
- CSV con «;» salen en una sola columna: léelos tal cual.
- Los documentos de clientes y sus `.md` nunca se suben a un repositorio público.
- Si algo falla, enseña el error tal cual y pregunta antes de probar otra cosa.
SKILL
  ok "Skill guardada en $DESTINO/SKILL.md"
fi

# 6 ── app de escritorio ─────────────────────────────────────────────────────
paso "6. App de escritorio de Claude"
if pregunta "¿Usas la app de escritorio de Claude y quieres MarkItDown también ahí?"; then
  DIR="$HOME/Library/Application Support/Claude"
  CONF="$DIR/claude_desktop_config.json"
  mkdir -p "$DIR"
  if [ -f "$CONF" ]; then
    COPIA="$CONF.copia-$(date +%Y%m%d-%H%M%S)"
    cp "$CONF" "$COPIA" || para "No he podido hacer la copia del archivo."
    ok "Copia hecha: $COPIA"
  else
    printf '{}\n' > "$CONF"; ok "No existía; lo he creado."
  fi
  # JavaScript de macOS (viene de serie): añade markitdown sin tocar lo demás y valida.
  RES="$(osascript -l JavaScript - "$CONF" "$UVX" <<'JXA'
function run(argv) {
  ObjC.import('Foundation');
  const ruta = argv[0], uvx = argv[1];
  const leer = () => ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(ruta, $.NSUTF8StringEncoding, null));
  let datos;
  try { datos = JSON.parse(leer() || '{}'); } catch (e) { return 'ERROR: el archivo no es JSON válido: ' + e.message; }
  datos.mcpServers = datos.mcpServers || {};
  if (datos.mcpServers.markitdown) return 'YA: ya había un conector markitdown; no lo toco.';
  datos.mcpServers.markitdown = { command: uvx, args: ['markitdown-mcp'] };
  $(JSON.stringify(datos, null, 2) + '\n').writeToFileAtomicallyEncodingError(ruta, true, $.NSUTF8StringEncoding, null);
  try { JSON.parse(leer()); } catch (e) { return 'ERROR: tras guardar, el JSON no es válido: ' + e.message; }
  return 'OK: markitdown añadido con ' + uvx + '. JSON válido.';
}
JXA
)"
  echo "  $RES"
  case "$RES" in ERROR*) para "No he podido tocar claude_desktop_config.json (tienes la copia al lado).";; esac
else
  ok "Sin app de escritorio: no toco nada."
fi

# 7 ── cómo terminar ─────────────────────────────────────────────────────────
paso "7. Para terminar"
echo "  • Claude Code: abre una sesión nueva y escribe /mcp → tiene que salir markitdown."
echo "  • App de escritorio: ciérrala del todo con Cmd+Q y vuelve a abrirla;"
echo "    markitdown tiene que salir en los conectores."
echo "  • Prueba: «Resúmeme en 5 puntos /ruta/a/un/contrato.pdf» (copia la ruta con"
echo "    clic derecho + tecla Opción → «Copiar … como nombre de ruta»)."
echo
read -r -p "Listo. Pulsa Intro para cerrar." _
