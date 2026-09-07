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

# Puerto configurado (para hablar con una copia que ya este funcionando).
$puerto = 4321
try {
  $cfg = Join-Path $env:USERPROFILE ".fotos-faciles\config.json"
  if (Test-Path $cfg) {
    $leido = (Get-Content $cfg -Raw | ConvertFrom-Json).puerto
    if ($leido) { $puerto = $leido }
  }
} catch { }

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
  $web = $shell.CreateShortcut((Join-Path $ESCRITORIO "Fotos Faciles (pantalla).lnk"))
  $web.TargetPath = "http://localhost:$puerto/"
  $web.Save()
  Bien "Tienes 'Fotos Faciles (pantalla)' en el Escritorio para abrirlo cuando quieras."
} catch {
  Aviso "No se ha podido crear el acceso del Escritorio, pero el arranque si esta puesto."
}

# 3) Arrancarlo ya, sin esperar a reiniciar.
#    Si habia una copia con ventana negra, se apaga primero: si no, la version
#    silenciosa veria el puerto ocupado, se cerraria sola, y al cerrar la
#    ventana negra el usuario se quedaria sin programa hasta reiniciar.
$habia = $false
try {
  $ping = Invoke-RestMethod "http://localhost:$puerto/api/estado-publico" -TimeoutSec 3
  if ($ping.app -eq "Fotos Faciles") { $habia = $true }
} catch { }

if ($habia) {
  Aviso "Ya habia una copia abierta (la ventana negra): la cierro y la dejo en segundo plano."
  try { Invoke-RestMethod "http://localhost:$puerto/api/apagar" -Method Post -TimeoutSec 5 | Out-Null } catch { }
  Start-Sleep -Seconds 2
}

Start-Process "wscript.exe" -ArgumentList """$SILENCIOSO""" -WindowStyle Hidden
Start-Sleep -Seconds 3
try {
  $ok = Invoke-RestMethod "http://localhost:$puerto/api/estado-publico" -TimeoutSec 5
  if ($ok.app -eq "Fotos Faciles") { Bien "Y ya esta funcionando en segundo plano, sin ventana." }
  else { Aviso "Arrancado, pero no contesta todavia. Abre la pantalla en unos segundos." }
} catch {
  Aviso "Arrancado. Si la pantalla no abre en unos segundos, reinicia el ordenador."
}

Write-Host ""
Write-Host "  Para apagarlo: abre la pantalla y pulsa 'Salir'." -ForegroundColor DarkGray
Write-Host "  Para quitar el arranque automatico: doble clic en QuitarArranqueAutomatico.bat" -ForegroundColor DarkGray
Write-Host ""
