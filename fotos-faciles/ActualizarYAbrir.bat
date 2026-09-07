@echo off
chcp 65001 >nul
title Fotos Faciles - actualizar y abrir
cd /d "%~dp0"

echo.
echo   Fotos Faciles - buscando novedades...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] No se ha encontrado Node.js en este ordenador.
  echo       Instalalo una sola vez desde https://nodejs.org  ^(version LTS^)
  echo       y vuelve a hacer doble clic en este archivo.
  echo.
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo   [i] No tienes Git instalado, asi que no se puede actualizar solo.
  echo       No pasa nada: se abre el programa con la version que ya tienes.
  echo.
  goto :arrancar
)

cd ..
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo   [i] Esta carpeta no viene de Git ^(seguramente la bajaste en ZIP^).
  echo       Se abre el programa con la version que ya tienes.
  echo.
  cd "%~dp0"
  goto :arrancar
)

REM Guardamos en que rama estabas, por si hay que volver.
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set RAMA=%%b
echo   Rama actual: %RAMA%

git fetch origin --quiet
if errorlevel 1 (
  echo   [i] No se ha podido conectar con GitHub. Se abre lo que ya tienes.
  echo.
  cd "%~dp0"
  goto :arrancar
)

REM Si Fotos Faciles ya esta en main, no hace falta cambiar de rama.
git cat-file -e origin/main:fotos-faciles/iniciar.mjs 2>nul
if not errorlevel 1 (
  echo   Fotos Faciles ya esta en la rama principal.
  git checkout main --quiet
  if errorlevel 1 goto :sinactualizar
  git pull --ff-only --quiet
  goto :listo
)

echo   Cambiando a la rama de Fotos Faciles...
git checkout claude/fotos-faciles-transferencia-a7urec --quiet
if errorlevel 1 goto :sinactualizar
git pull --ff-only --quiet
goto :listo

:sinactualizar
echo.
echo   [!] No se ha podido actualizar. Suele ser porque tienes cambios sin
echo       guardar en el proyecto. Se abre el programa con lo que ya tienes.
echo.
cd "%~dp0"
goto :arrancar

:listo
echo   Actualizado.
echo.
cd "%~dp0"

:arrancar
echo   Arrancando... ^(para cerrar el programa, cierra esta ventana^)
echo.
node iniciar.mjs %*
pause
