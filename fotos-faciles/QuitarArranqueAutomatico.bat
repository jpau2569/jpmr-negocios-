@echo off
chcp 65001 >nul
title Fotos Faciles - quitar el arranque automatico
cd /d "%~dp0"

echo.
echo   Voy a quitar el arranque automatico con Windows.
echo   El programa seguira estando: solo dejara de abrirse solo.
echo.

if not exist "herramientas\arranque-automatico.ps1" (
  echo   [!] Falta herramientas\arranque-automatico.ps1
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0herramientas\arranque-automatico.ps1" -Quitar
echo.
pause
