#!/usr/bin/env bash
# ============================================================================
#  Instala el ecosistema personal de Pau en ~/.claude/
# ----------------------------------------------------------------------------
#  Los agentes y skills de este repositorio son de uso general (empleo,
#  ingresos, capital): no pertenecen a jpmr-negocios-. Este script los copia a
#  nivel de usuario para que estén disponibles en TODOS los proyectos.
#
#  Uso, desde la raíz del repositorio:  bash .claude/instalar-global.sh
#
#  Si ya existe ~/.claude/CLAUDE.md, se guarda una copia de seguridad fechada
#  antes de sobrescribirlo. Las skills sincronizadas (~/.claude/skills/synced)
#  no se tocan.
# ============================================================================
set -euo pipefail

origen="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
destino="$HOME/.claude"

mkdir -p "$destino/agents" "$destino/skills"

if [ -f "$destino/CLAUDE.md" ] && ! cmp -s "$origen/global/CLAUDE.md" "$destino/CLAUDE.md"; then
  copia="$destino/CLAUDE.md.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$destino/CLAUDE.md" "$copia"
  echo "  · copia de seguridad del CLAUDE.md anterior → $copia"
fi

cp "$origen/global/CLAUDE.md" "$destino/CLAUDE.md"
echo "  ✅ ~/.claude/CLAUDE.md (normas de trabajo)"

for agente in "$origen"/agents/*.md; do
  cp "$agente" "$destino/agents/"
  echo "  ✅ ~/.claude/agents/$(basename "$agente")"
done

for skill in "$origen"/skills/*/; do
  nombre="$(basename "$skill")"
  mkdir -p "$destino/skills/$nombre"
  cp -R "$skill." "$destino/skills/$nombre/"
  echo "  ✅ ~/.claude/skills/$nombre/"
done

echo
echo "Listo. Abre una sesión nueva de Claude Code para que los cargue."
