// ============================================================================
//  Fotos Fáciles — iPhone y móviles MTP por cable en Windows (WPD)
// ----------------------------------------------------------------------------
//  Un iPhone conectado por cable a Windows NO recibe letra de unidad: se expone
//  por MTP y solo vive dentro del espacio de nombres del Explorador. La forma de
//  llegar a él sin compilar un módulo nativo es la interfaz COM `Shell.
//  Application`, que es exactamente la que usa el propio Explorador; se invoca
//  con PowerShell y se devuelve JSON.
//
//  Cómo funciona:
//   · `Shell.NameSpace(17)` es "Este equipo". Sus elementos son las unidades
//     (C:\, D:\…) y los DISPOSITIVOS PORTÁTILES, que se distinguen porque su
//     `Path` no empieza por una letra de unidad.
//   · Se navega por NOMBRES ("Apple iPhone" → "Internal Storage" → "DCIM" →
//     "100APPLE") en vez de por rutas, porque las rutas MTP son GUID
//     inestables entre conexiones.
//   · Copiar es `CopyHere`, que es ASÍNCRONO: se espera a que aparezcan los
//     archivos en la carpeta temporal antes de seguir.
//
//  ESTADO: escrito y probado en su lógica (construcción del guion y lectura de
//  la respuesta), pero NO sobre un iPhone real: este entorno de desarrollo es
//  Linux. Por eso la interfaz lo muestra como experimental y, si algo falla,
//  dice que el camino seguro es el modo WiFi con QR.
// ============================================================================
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";

const TIEMPO_MAX = 60_000;

export const disponible = () => process.platform === "win32";

/** Ejecuta un guion de PowerShell y devuelve lo que haya impreso. */
function ejecutaPowerShell(guion, { timeout = TIEMPO_MAX } = {}) {
  const codificado = Buffer.from(guion, "utf16le").toString("base64");
  return new Promise((resolve, reject) => {
    execFile("powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codificado],
      { timeout, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr?.trim() || error.message));
        resolve(String(stdout || "").trim());
      });
  });
}

/** Lee la salida JSON de PowerShell, que devuelve un objeto suelto si hay uno solo. */
export function comoLista(salida) {
  if (!salida) return [];
  let datos;
  try { datos = JSON.parse(salida); } catch { return []; }
  if (datos == null) return [];
  return Array.isArray(datos) ? datos : [datos];
}

/** Escapa un texto para meterlo entre comillas simples de PowerShell. */
export const escapaPs = (t) => String(t ?? "").replace(/'/g, "''");

/** Trozo de guion que baja desde "Este equipo" hasta la carpeta pedida. */
export function guionNavegar(camino = []) {
  const pasos = camino.map((nombre) => `
  if ($carpeta -eq $null) { break }
  $siguiente = $null
  foreach ($it in $carpeta.Items()) { if ($it.Name -eq '${escapaPs(nombre)}') { $siguiente = $it; break } }
  if ($siguiente -eq $null -or -not $siguiente.IsFolder) { $carpeta = $null; break }
  $carpeta = $siguiente.GetFolder`).join("\n");
  return `
$shell = New-Object -ComObject Shell.Application
$carpeta = $shell.NameSpace(17)
do {${pasos}
} while ($false)`;
}

/** Dispositivos portátiles conectados (iPhone, Android en modo MTP, cámaras). */
export async function dispositivos(ejecutor = ejecutaPowerShell) {
  if (!disponible()) return [];
  const guion = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$shell = New-Object -ComObject Shell.Application
$equipo = $shell.NameSpace(17)
$salida = @()
foreach ($it in $equipo.Items()) {
  if (-not $it.IsFolder) { continue }
  if ($it.Path -match '^[A-Za-z]:\\\\?$') { continue }
  $salida += [PSCustomObject]@{ nombre = $it.Name; tipo = $it.Type; ruta = $it.Path }
}
$salida | ConvertTo-Json -Compress`;
  try { return interpretaDispositivos(await ejecutor(guion, { timeout: 15000 })); }
  catch { return []; }
}

/** Convierte la respuesta de PowerShell en la lista de dispositivos. */
export function interpretaDispositivos(salida) {
  return comoLista(salida)
    .filter((d) => d && d.nombre)
    .map((d) => ({ nombre: d.nombre, tipo: d.tipo || "Dispositivo portátil", camino: [d.nombre], portatil: true }));
}

/** Contenido de una carpeta del dispositivo: subcarpetas y archivos. */
export async function explora(camino = [], ejecutor = ejecutaPowerShell) {
  if (!disponible()) return { carpetas: [], archivos: [] };
  const guion = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${guionNavegar(camino)}
if ($carpeta -eq $null) { '[]'; exit }
$salida = @()
foreach ($it in $carpeta.Items()) {
  $tam = 0
  try { $tam = [int64]$it.ExtendedProperty('System.Size') } catch { $tam = 0 }
  $fecha = ''
  try { $fecha = ([datetime]$it.ExtendedProperty('System.DateModified')).ToString('o') } catch { $fecha = '' }
  $salida += [PSCustomObject]@{ nombre = $it.Name; carpeta = [bool]$it.IsFolder; tamano = $tam; modificado = $fecha }
}
$salida | ConvertTo-Json -Compress`;
  return interpretaContenido(await ejecutor(guion, { timeout: 45000 }), camino);
}

/** Convierte la respuesta de PowerShell en carpetas y archivos. */
export function interpretaContenido(salida, camino = []) {
  const items = comoLista(salida).filter((i) => i && i.nombre);
  return {
    carpetas: items.filter((i) => i.carpeta).map((i) => ({ nombre: i.nombre, camino: [...camino, i.nombre] })),
    archivos: items.filter((i) => !i.carpeta).map((i) => ({
      nombre: i.nombre, tamano: Number(i.tamano) || 0, modificado: i.modificado || null,
      camino: [...camino, i.nombre],
    })),
  };
}

/**
 * Copia archivos del dispositivo a una carpeta temporal del PC.
 * `CopyHere` no es bloqueante, así que el guion espera a que aparezcan.
 */
export async function copia(camino, nombres, destino, ejecutor = ejecutaPowerShell) {
  if (!disponible()) throw new Error("Solo disponible en Windows");
  if (!nombres.length) return [];
  await fsp.mkdir(destino, { recursive: true });
  const lista = nombres.map((n) => `'${escapaPs(n)}'`).join(",");
  const guion = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${guionNavegar(camino)}
if ($carpeta -eq $null) { throw 'No se encuentra la carpeta en el dispositivo' }
$destino = $shell.NameSpace('${escapaPs(path.resolve(destino))}')
$quiero = @(${lista})
$copiados = @()
foreach ($it in $carpeta.Items()) {
  if ($quiero -contains $it.Name) {
    $destino.CopyHere($it, 16)
    $copiados += $it.Name
  }
}
# CopyHere es asíncrono: se espera a que los archivos existan y dejen de crecer.
$limite = (Get-Date).AddSeconds(240)
foreach ($n in $copiados) {
  $ruta = Join-Path '${escapaPs(path.resolve(destino))}' $n
  $anterior = -1
  while ((Get-Date) -lt $limite) {
    if (Test-Path -LiteralPath $ruta) {
      $ahora = (Get-Item -LiteralPath $ruta).Length
      if ($ahora -gt 0 -and $ahora -eq $anterior) { break }
      $anterior = $ahora
    }
    Start-Sleep -Milliseconds 400
  }
}
$copiados | ConvertTo-Json -Compress`;
  const copiados = comoLista(await ejecutor(guion, { timeout: 300_000 }));
  return copiados.map((n) => path.join(destino, String(n)));
}

/** Carpeta temporal donde se dejan las fotos que llegan del dispositivo. */
export function carpetaTemporal() {
  return path.join(os.tmpdir(), "fotos-faciles-mtp");
}

/** Nombres de carpeta que suelen contener las fotos dentro de un móvil MTP. */
export const CARPETAS_INTERESANTES = ["DCIM", "Internal Storage", "Almacenamiento interno", "Pictures", "Imágenes", "Camera", "Cámara"];
