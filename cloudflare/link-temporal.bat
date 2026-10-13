@echo off
setlocal EnableExtensions EnableDelayedExpansion
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
  echo  No encuentro cloudflared en este PC. Hace falta para el link temporal.
  where winget >nul 2>nul && (
    set "INSTALAR="
    set /p "INSTALAR=Lo instalo ahora con winget? Escribe S y pulsa Intro: "
    if /i "!INSTALAR!"=="S" (
      winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
      if exist "!ProgramFiles!\cloudflared\cloudflared.exe" set "CFD=!ProgramFiles!\cloudflared\cloudflared.exe"
      if exist "!ProgramFiles(x86)!\cloudflared\cloudflared.exe" set "CFD=!ProgramFiles(x86)!\cloudflared\cloudflared.exe"
    )
  )
)
if not defined CFD (
  echo.
  echo  Sigue sin estar cloudflared. Si acabas de instalarlo, cierra esta ventana y vuelve a abrir el .bat.
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
echo    8788 = castresana-web en local (Valora tu piso y visitas)
echo    8790 = hojas-firmadas en local (firmas con el dedo)
echo    4321 = Fotos Faciles (comparte solo enlaces de album /a/...)
echo.
set "PUERTO="
set /p "PUERTO=Puerto: "

rem --------------------------------------------------------------------------
rem  Validar el puerto ANTES de usarlo en ninguna comparacion ni comando.
rem  Todo con !PUERTO! (expansion retardada): lo que escriba el usuario nunca
rem  se interpreta como codigo, asi que "1&calc&rem" no ejecuta nada.
rem  Nada de "echo ... | findstr": en una tuberia cada lado corre en otro cmd
rem  sin expansion retardada y volveria a ser inyectable.
rem   1) Que haya algo escrito.
rem   2) Solo cifras: se quitan las 10 cifras y no puede quedar nada.
rem   3) Sin cero delante (cmd leeria 08080 como octal) y hasta 5 cifras.
rem   4) Solo entonces, que este entre 1 y 65535.
rem --------------------------------------------------------------------------
if not defined PUERTO goto :malpuerto
set "RESTO=x!PUERTO!"
for %%D in (0 1 2 3 4 5 6 7 8 9) do set "RESTO=!RESTO:%%D=!"
if not "!RESTO!"=="x" goto :malpuerto
if "!PUERTO:~0,1!"=="0" goto :malpuerto
if not "!PUERTO:~5!"=="" goto :malpuerto
if !PUERTO! LSS 1 goto :malpuerto
if !PUERTO! GTR 65535 goto :malpuerto

echo.
echo  Abriendo el tunel hacia http://127.0.0.1:!PUERTO! ...
echo  Antes tiene que estar abierta la otra ventana con la app en marcha.
echo  Busca abajo una linea con  https://....trycloudflare.com  y mandasela al cliente.
echo  Para APAGARLO: cierra esta ventana (o pulsa Ctrl+C).
echo.
"!CFD!" tunnel --url http://127.0.0.1:!PUERTO!
echo.
echo  El tunel se ha cerrado. El enlace ya no funciona.
pause
exit /b 0

:malpuerto
echo.
echo  "!PUERTO!" no es un puerto valido. Tiene que ser un numero entre 1 y 65535, sin espacios ni otros signos.
pause
exit /b 1
