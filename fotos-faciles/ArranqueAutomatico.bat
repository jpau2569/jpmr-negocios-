@echo off
chcp 65001 >nul
title Fotos Faciles - arranque automatico
cd /d "%~dp0"

echo.
echo   Voy a hacer que Fotos Faciles arranque solo con Windows,
echo   en segundo plano y sin ninguna ventana.
echo.

if not exist "herramientas\arranque-automatico.ps1" (
  echo   [!] Falta herramientas\arranque-automatico.ps1
  echo       Actualiza el programa y vuelve a intentarlo.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\arranque-automatico.ps1"
echo.
pause
