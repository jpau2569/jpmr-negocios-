# ============================================================================
#  Fotos Faciles - que arranque solo con Windows, sin ventana negra
# ----------------------------------------------------------------------------
#  Pone (o quita) un acceso directo en la carpeta de Inicio de Windows que
#  lanza el programa en segundo plano al encender el ordenador. Tambien deja
#  en el Escritorio un acceso a la pantalla del programa.
#
#  Activar:    powershell -ExecutionPolicy Bypass -File arranque-automatico.ps1
#  Desactivar: powershell -ExecutionPolicy Bypass -File arranque-automatico.ps1 -Quitar
#
#  No necesita permisos de administrador: escribe solo en tu propia sesion.
# ============================================================================
param([switch]$Quitar)

$ErrorActionPreference = "Stop"

$APP        = Split-Path -Parent $PSScriptRoot           # ...\fotos-faciles
$SILENCIOSO = Join-Path $APP "FotosFacilesSilencioso.vbs"
$INICIO     = [Environment]::GetFolderPath("Startup")
$ATAJO      = Join-Path $INICIO "Fotos Faciles.lnk"
$ESCRITORIO = [Environment]::GetFolderPath("Desktop")

function Bien($t) { Write-Host "  $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  $t" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  Fotos Faciles - arranque automatico" -ForegroundColor White
Write-Host ""

if ($Quitar) {
  if (Test-Path $ATAJO) { Remove-Item $ATAJO -Force; Bien "Quitado: ya no arrancara solo con Windows." }
  else { Aviso "No estaba puesto, no hay nada que quitar." }
  Write-Host ""
  return
}

if (-not (Test-Path $SILENCIOSO)) {
  Aviso "No encuentro $SILENCIOSO"
  return
}

$shell = New-Object -ComObject WScript.Shell

# 1) Arranque con Windows, en segundo plano.
$lnk = $shell.CreateShortcut($ATAJO)
$lnk.TargetPath = "wscript.exe"
$lnk.Arguments = """$SILENCIOSO"""
$lnk.WorkingDirectory = $APP
$lnk.Description = "Fotos Faciles en segundo plano"
$lnk.Save()
Bien "Listo: arrancara solo cada vez que enciendas el ordenador."

# 2) Acceso a la pantalla del programa, para abrirla cuando haga falta.
try {
  $puerto = 4321
  $cfg = Join-Path $env:USERPROFILE ".fotos-faciles\config.json"
  if (Test-Path $cfg) {
    $leido = (Get-Content $cfg -Raw | ConvertFrom-Json).puerto
    if ($leido) { $puerto = $leido }
  }
  $web = $shell.CreateShortcut((Join-Path $ESCRITORIO "Fotos Faciles (pantalla).lnk"))
  $web.TargetPath = "http://localhost:$puerto/"
  $web.Save()
  Bien "Tienes 'Fotos Faciles (pantalla)' en el Escritorio para abrirlo cuando quieras."
} catch {
  Aviso "No se ha podido crear el acceso del Escritorio, pero el arranque si esta puesto."
}

# 3) Arrancarlo ya, sin esperar a reiniciar.
Start-Process "wscript.exe" -ArgumentList """$SILENCIOSO""" -WindowStyle Hidden
Bien "Y lo he arrancado ya, en segundo plano."

Write-Host ""
Write-Host "  Para apagarlo: abre la pantalla y pulsa 'Salir'." -ForegroundColor DarkGray
Write-Host "  Para quitar el arranque automatico: vuelve a ejecutar esto con -Quitar" -ForegroundColor DarkGray
Write-Host ""
