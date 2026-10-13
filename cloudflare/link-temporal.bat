@echo off
setlocal EnableExtensions
title Link temporal (Cloudflare Quick Tunnel) - se apaga al cerrar esta ventana
rem ==========================================================================
rem  Link temporal para ensenar una demo desde este PC (Cloudflare Quick Tunnel)
rem  - Sin cuenta ni dominio: no usa el plan de Cloudflare de Pau.
rem  - Da una direccion https://xxxx.trycloudflare.com aleatoria.
rem  - Se apaga al cerrar esta ventana. Solo para pruebas.
rem  - Cualquiera con el enlace puede entrar: no ensenes nada privado.
rem  Necesita cloudflared instalado:
rem  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
rem ==========================================================================

set "CFD="
where cloudflared >nul 2>nul && set "CFD=cloudflared"
if not defined CFD if exist "%~dp0cloudflared.exe" set "CFD=%~dp0cloudflared.exe"
if not defined CFD if exist "%ProgramFiles%\cloudflared\cloudflared.exe" set "CFD=%ProgramFiles%\cloudflared\cloudflared.exe"
if not defined CFD if exist "%ProgramFiles(x86)%\cloudflared\cloudflared.exe" set "CFD=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if not defined CFD (
  echo.
  echo  No encuentro cloudflared en este PC.
  echo  Instalalo desde la pagina oficial:
  echo    https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/
  echo  Windows 64 bits, instalador:
  echo    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi
  echo  O deja cloudflared.exe en esta misma carpeta.
  echo.
  pause
  exit /b 1
)

echo.
echo  Que quieres ensenar? Escribe el PUERTO de tu PC:
echo    8080 = demo del escaparate servida con "python -m http.server 8080"
echo    8788 = castresana-web en local (probar-en-local.mjs)
echo    4321 = Fotos Faciles (comparte solo enlaces de album /a/...)
echo.
set "PUERTO="
set /p "PUERTO=Puerto: "

rem Solo cifras y entre 1 y 65535.
echo(%PUERTO%| findstr /r "^[0-9][0-9]*$" >nul || goto :malpuerto
if %PUERTO% LSS 1 goto :malpuerto
if %PUERTO% GTR 65535 goto :malpuerto

echo.
echo  Abriendo el tunel hacia http://localhost:%PUERTO% ...
echo  Busca abajo una linea con  https://....trycloudflare.com  y mandasela al cliente.
echo  Para APAGARLO: cierra esta ventana (o pulsa Ctrl+C).
echo.
"%CFD%" tunnel --url http://localhost:%PUERTO%
echo.
echo  El tunel se ha cerrado. El enlace ya no funciona.
pause
exit /b 0

:malpuerto
echo.
echo  "%PUERTO%" no es un puerto valido. Tiene que ser un numero entre 1 y 65535.
pause
exit /b 1
