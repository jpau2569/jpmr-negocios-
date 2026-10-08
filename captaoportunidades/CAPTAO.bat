@echo off
chcp 65001 >nul
title CAPTAOPORTUNIDADES ASTURIAS
cd /d "%~dp0\.."
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Necesitas instalar Node.js 22.13 o superior: https://nodejs.org
  echo.
  pause
  exit /b 1
)
node captaoportunidades\iniciar.mjs
pause
