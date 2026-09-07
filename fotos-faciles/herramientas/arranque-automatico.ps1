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

# Con OneDrive el Escritorio puede estar en dos sitios: se usan todos los que
# existan de verdad, para que el icono no acabe en el que no se ve.
function EscritoriosPosibles {
  @(
    [Environment]::GetFolderPath("Desktop"),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "Escritorio"),
    (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
    (Join-Path $env:USERPROFILE "OneDrive\Escritorio")
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
}

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
#    OJO: para una direccion web hace falta un archivo .url (acceso directo de
#    Internet). Un .lnk con una URL como destino se guarda pero Windows no lo
#    muestra como acceso valido; ese fue un fallo real de la primera version.
$puestos = 0
foreach ($esc in EscritoriosPosibles) {
  try {
    $destino = Join-Path $esc "Fotos Faciles (pantalla).url"
    "[InternetShortcut]`r`nURL=http://localhost:$puerto/`r`nIconIndex=0" |
      Out-File -FilePath $destino -Encoding ASCII -Force
    if (Test-Path $destino) { $puestos++; Write-Host "     -> $esc" -ForegroundColor DarkGray }
    # Limpieza del .lnk mal creado por la version anterior, si estuviera ahi.
    $viejo = Join-Path $esc "Fotos Faciles (pantalla).lnk"
    if (Test-Path $viejo) { Remove-Item $viejo -Force -ErrorAction SilentlyContinue }
  } catch { }
}
if ($puestos -gt 0) { Bien "Tienes 'Fotos Faciles (pantalla)' en el Escritorio." }
else { Aviso "Sin icono en el Escritorio. Entra escribiendo localhost:$puerto en el navegador." }

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
Write-Host "  La pantalla del programa: http://localhost:$puerto  (o el icono del Escritorio)" -ForegroundColor DarkGray
Write-Host "  Para apagarlo: abre la pantalla y pulsa 'Salir'." -ForegroundColor DarkGray
Write-Host "  Para quitar el arranque automatico: doble clic en QuitarArranqueAutomatico.bat" -ForegroundColor DarkGray
Write-Host ""
