#!/bin/bash
# Doble clic en macOS (o "bash iniciar.command" en Linux) para arrancar Fotos Fáciles.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  No se ha encontrado Node.js en este ordenador."
  echo "  Instálalo una sola vez desde https://nodejs.org (versión LTS)"
  echo "  y vuelve a abrir este archivo."
  echo
  read -r -p "Pulsa Intro para cerrar..."
  exit 1
fi

node iniciar.mjs "$@"
