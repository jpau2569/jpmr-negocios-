@echo off
chcp 65001 >nul
title Fotos Faciles - Pasar a Ordenador
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se ha encontrado Node.js en este ordenador.
  echo   Instalalo una sola vez desde https://nodejs.org  ^(version LTS^)
  echo   y vuelve a hacer doble clic en este archivo.
  echo.
  pause
  exit /b 1
)

echo Arrancando Fotos Faciles... (para cerrar, cierra esta ventana)
node iniciar.mjs %*
pause
