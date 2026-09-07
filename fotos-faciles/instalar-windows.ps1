# ============================================================================
#  Fotos Faciles - instalador para Windows
# ----------------------------------------------------------------------------
#  Descarga el programa, lo deja en tu carpeta personal, crea un acceso directo
#  en el Escritorio y lo abre. No necesita permisos de administrador y no toca
#  nada mas del ordenador.
#
#  Se ejecuta pegando esta linea en PowerShell:
#
#    irm https://raw.githubusercontent.com/jpau2569/jpmr-negocios-/main/fotos-faciles/instalar-windows.ps1 | iex
#
#  Volver a ejecutarlo actualiza el programa. Tus fotos y tus ajustes NO se
#  tocan: viven fuera de esta carpeta (en "Fotos Faciles" y en ".fotos-faciles"
#  dentro de tu carpeta personal).
# ============================================================================

$ErrorActionPreference = "Stop"

# Se prueba primero la rama principal y, si ahi todavia no esta el programa
# (porque la rama de trabajo aun no se ha fusionado), se cae a la rama de
# trabajo. Asi el mismo comando sirve antes y despues de fusionar el PR.
$REPO  = "https://github.com/jpau2569/jpmr-negocios-"
$RAMAS = @("main", "claude/fotos-faciles-transferencia-a7urec")
$MARCA = Join-Path "fotos-faciles" "FotosFaciles.bat"   # con esto sabemos que el ZIP sirve
$BASE  = Join-Path $env:USERPROFILE "FotosFaciles"
$APP   = Join-Path $BASE "programa"

function Paso($texto) { Write-Host "  $texto" -ForegroundColor Cyan }
function Bien($texto) { Write-Host "  $texto" -ForegroundColor Green }
function Mal($texto)  { Write-Host "  $texto" -ForegroundColor Red }

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host "   Fotos Faciles - Pasar a Ordenador" -ForegroundColor White
Write-Host "  ==========================================" -ForegroundColor DarkGray
Write-Host ""

# --- 1. Comprobar Node.js ---------------------------------------------------
Paso "1/4  Comprobando Node.js..."
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host ""
  Mal "No se encuentra Node.js en este ordenador."
  Write-Host ""
  Write-Host "     Instalalo (es gratis y tarda 2 minutos):" -ForegroundColor Yellow
  Write-Host "       1. Se abrira nodejs.org en el navegador."
  Write-Host "       2. Descarga el boton grande que pone LTS."
  Write-Host "       3. Abrelo y dale a Siguiente hasta el final."
  Write-Host "       4. CIERRA esta ventana, abre PowerShell otra vez"
  Write-Host "          y vuelve a pegar la misma linea."
  Write-Host ""
  Start-Process "https://nodejs.org"
  return
}
Bien "Node.js $(& node -v) encontrado."

# --- 2. Descargar -----------------------------------------------------------
Paso "2/4  Descargando el programa desde GitHub..."
$temporal = Join-Path $env:TEMP ("fotos-faciles-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $temporal | Out-Null

$extraido = $null
$fallo = ""
foreach ($rama in $RAMAS) {
  $carpetaRama = Join-Path $temporal ($rama -replace "[\\/]", "-")
  $zip = "$carpetaRama.zip"
  try {
    $anterior = $ProgressPreference
    $ProgressPreference = "SilentlyContinue"   # sin esto la descarga va lentisima
    Invoke-WebRequest -Uri "$REPO/archive/refs/heads/$rama.zip" -OutFile $zip -UseBasicParsing
    $ProgressPreference = $anterior
  } catch {
    $fallo = $_.Exception.Message
    continue
  }
  Expand-Archive -Path $zip -DestinationPath $carpetaRama -Force
  $candidato = Get-ChildItem $carpetaRama -Directory | Select-Object -First 1
  if ($candidato -and (Test-Path (Join-Path $candidato.FullName $MARCA))) {
    $extraido = $candidato
    Bien ("Descargado de la rama '$rama' (" + [math]::Round((Get-Item $zip).Length / 1KB) + " KB).")
    break
  }
}

if (-not $extraido) {
  Mal "No se ha podido descargar el programa."
  if ($fallo) { Write-Host "     Detalle: $fallo" }
  Write-Host "     Comprueba que tienes internet y vuelve a intentarlo."
  Remove-Item $temporal -Recurse -Force -ErrorAction SilentlyContinue
  return
}

# --- 3. Instalar ------------------------------------------------------------
Paso "3/4  Colocandolo en $BASE ..."

New-Item -ItemType Directory -Force -Path $BASE | Out-Null
if (Test-Path $APP) { Remove-Item $APP -Recurse -Force }   # solo el programa; las fotos estan fuera
Move-Item $extraido.FullName $APP
Remove-Item $temporal -Recurse -Force -ErrorAction SilentlyContinue

$arranque = Join-Path $APP $MARCA
if (-not (Test-Path $arranque)) { Mal "Falta el arranque del programa. Avisa a Claude."; return }
Bien "Instalado."

# --- 4. Acceso directo en el Escritorio ------------------------------------
#  Con OneDrive el Escritorio puede estar en dos sitios y el icono aparecer en
#  el que NO se ve. Se crea en todos los candidatos que existan de verdad.
function EscritoriosPosibles {
  @(
    [Environment]::GetFolderPath("Desktop"),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "Escritorio"),
    (Join-Path $env:USERPROFILE "OneDrive\Desktop"),
    (Join-Path $env:USERPROFILE "OneDrive\Escritorio")
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
}

Paso "4/4  Creando el acceso directo en el Escritorio..."
$puestos = 0
foreach ($esc in EscritoriosPosibles) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut((Join-Path $esc "Fotos Faciles.lnk"))
    $lnk.TargetPath = $arranque
    $lnk.WorkingDirectory = Split-Path $arranque
    $lnk.Description = "Pasar fotos del movil al ordenador"
    $lnk.Save()
    $puestos++
    Write-Host "     -> $esc" -ForegroundColor DarkGray
  } catch { }
}
if ($puestos -gt 0) { Bien "Listo: tienes 'Fotos Faciles' en el Escritorio." }
else {
  Bien "Instalado. No se ha podido crear el icono, pero se abre siempre desde:"
  Write-Host "     $arranque" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  ------------------------------------------" -ForegroundColor DarkGray
Write-Host "   IMPORTANTE la primera vez:" -ForegroundColor Yellow
Write-Host "   Windows preguntara por el cortafuegos."
Write-Host "   Marca 'Redes privadas' y pulsa PERMITIR ACCESO."
Write-Host "   Si le das a Cancelar, el movil no podra conectarse."
Write-Host "  ------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   Carpeta del programa: $APP" -ForegroundColor DarkGray
Write-Host "   Tus fotos iran a:     $env:USERPROFILE\Fotos Faciles" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   Para que arranque solo con Windows y sin ventana, doble clic en:" -ForegroundColor DarkGray
Write-Host "   $(Join-Path (Split-Path $arranque) 'ArranqueAutomatico.bat')" -ForegroundColor DarkGray
Write-Host ""
Paso "Abriendo el programa..."
Write-Host ""
Start-Process $arranque
