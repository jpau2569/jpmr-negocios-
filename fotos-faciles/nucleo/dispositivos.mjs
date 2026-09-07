// ============================================================================
//  Fotos Fáciles — Modo A: pendrives, tarjetas SD y móviles por cable
// ----------------------------------------------------------------------------
//  Detecta unidades conectadas y busca dentro las carpetas donde de verdad
//  están las fotos (DCIM, Pictures, y las de WhatsApp en Android).
//
//  AVISO HONESTO, porque afecta al iPhone: en Windows un iPhone se conecta por
//  MTP y aparece como "dispositivo portátil" del Explorador, SIN letra de
//  unidad. Ninguna app puede leerlo como una carpeta normal sin usar la API
//  WPD de Windows. Por eso el camino recomendado para el iPhone es el Modo B
//  (WiFi + QR); el Modo A cubre pendrives, tarjetas SD, cámaras y Android en
//  modo "Transferencia de archivos", y el Modo C permite pegar lo que el
//  Explorador ya haya dejado en una carpeta.
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { esMedia, esFoto, esVideo } from "./util.mjs";

const ejecuta = promisify(execFile);
const IGNORADAS = new Set([
  "$recycle.bin", "system volume information", ".spotlight-v100", ".trashes", ".fseventsd",
  "node_modules", ".git", ".fotos-faciles", "lost+found", ".thumbnails",
]);

/** Carpetas donde suelen estar las fotos dentro de un móvil o una tarjeta. */
export const CARPETAS_TIPICAS = [
  { rel: "DCIM", etiqueta: "Cámara (DCIM)" },
  { rel: "Pictures", etiqueta: "Imágenes" },
  { rel: "Movies", etiqueta: "Vídeos" },
  { rel: "Download", etiqueta: "Descargas" },
  { rel: "WhatsApp/Media/WhatsApp Images", etiqueta: "WhatsApp · Imágenes" },
  { rel: "WhatsApp/Media/WhatsApp Video", etiqueta: "WhatsApp · Vídeos" },
  { rel: "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images", etiqueta: "WhatsApp · Imágenes" },
  { rel: "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video", etiqueta: "WhatsApp · Vídeos" },
];

async function unidadesWindows() {
  const guion = "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,DriveType,Size,FreeSpace | ConvertTo-Json -Compress";
  const { stdout } = await ejecuta("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", guion], { timeout: 8000 });
  const crudo = JSON.parse(stdout || "[]");
  const lista = Array.isArray(crudo) ? crudo : [crudo];
  return lista.filter(Boolean).map((u) => ({
    ruta: `${u.DeviceID}\\`,
    etiqueta: u.VolumeName || `Unidad ${u.DeviceID}`,
    extraible: u.DriveType === 2,
    sistema: u.DriveType === 3 && /^C:/i.test(u.DeviceID),
    tamano: Number(u.Size) || 0,
    libre: Number(u.FreeSpace) || 0,
  }));
}

async function unidadesMac() {
  const salida = [];
  for (const nombre of await fsp.readdir("/Volumes").catch(() => [])) {
    const ruta = path.join("/Volumes", nombre);
    const info = await fsp.stat(ruta).catch(() => null);
    if (info?.isDirectory()) salida.push({ ruta, etiqueta: nombre, extraible: true, sistema: nombre === "Macintosh HD" });
  }
  return salida;
}

async function unidadesLinux() {
  const salida = [];
  const raices = ["/media", "/run/media", "/mnt"];
  for (const raiz of raices) {
    for (const nombre of await fsp.readdir(raiz).catch(() => [])) {
      const ruta = path.join(raiz, nombre);
      const info = await fsp.stat(ruta).catch(() => null);
      if (!info?.isDirectory()) continue;
      // /media/<usuario>/<pendrive>: hay que bajar un nivel.
      const dentro = await fsp.readdir(ruta).catch(() => []);
      const subcarpetas = [];
      for (const sub of dentro) {
        const rutaSub = path.join(ruta, sub);
        if ((await fsp.stat(rutaSub).catch(() => null))?.isDirectory()) subcarpetas.push({ ruta: rutaSub, etiqueta: sub });
      }
      if (raiz !== "/mnt" && subcarpetas.length) salida.push(...subcarpetas.map((s) => ({ ...s, extraible: true })));
      else salida.push({ ruta, etiqueta: nombre, extraible: true });
    }
  }
  return salida;
}

/** Unidades conectadas ahora mismo, con las extraíbles primero. */
export async function listaUnidades() {
  let lista = [];
  try {
    if (process.platform === "win32") lista = await unidadesWindows();
    else if (process.platform === "darwin") lista = await unidadesMac();
    else lista = await unidadesLinux();
  } catch { lista = []; }

  const vistas = new Set();
  const salida = [];
  for (const u of lista) {
    if (!u.ruta || vistas.has(u.ruta)) continue;
    vistas.add(u.ruta);
    if (!fs.existsSync(u.ruta)) continue;
    salida.push({ ...u, carpetasFoto: await carpetasConFotos(u.ruta) });
  }
  salida.sort((a, b) => (b.extraible - a.extraible) || a.etiqueta.localeCompare(b.etiqueta, "es"));
  return salida;
}

/** Busca las carpetas típicas de fotos dentro de una unidad (2 niveles). */
export async function carpetasConFotos(raiz) {
  const encontradas = [];
  const prueba = async (base) => {
    for (const { rel, etiqueta } of CARPETAS_TIPICAS) {
      const ruta = path.join(base, ...rel.split("/"));
      if ((await fsp.stat(ruta).catch(() => null))?.isDirectory()) encontradas.push({ ruta, etiqueta });
    }
  };
  await prueba(raiz);
  if (!encontradas.length) {
    // Algunos móviles montan la memoria interna un nivel más abajo.
    for (const nombre of (await fsp.readdir(raiz).catch(() => [])).slice(0, 12)) {
      const sub = path.join(raiz, nombre);
      if ((await fsp.stat(sub).catch(() => null))?.isDirectory()) await prueba(sub);
      if (encontradas.length) break;
    }
  }
  const vistas = new Set();
  return encontradas.filter((c) => !vistas.has(c.ruta) && vistas.add(c.ruta));
}

/**
 * Recorre una carpeta buscando fotos y vídeos.
 * `yaEsta(nombre, tamano)` permite marcar lo que ya se importó otras veces.
 */
export async function escanea(raiz, { limite = 3000, profundidad = 6, yaEsta = () => null } = {}) {
  const archivos = [];
  let cortado = false;

  async function baja(carpeta, nivel) {
    if (archivos.length >= limite || nivel > profundidad) { cortado = cortado || archivos.length >= limite; return; }
    let entradas = [];
    try { entradas = await fsp.readdir(carpeta, { withFileTypes: true }); } catch { return; }
    const subcarpetas = [];
    for (const e of entradas) {
      if (e.name.startsWith(".") || IGNORADAS.has(e.name.toLowerCase())) continue;
      const ruta = path.join(carpeta, e.name);
      if (e.isDirectory()) { subcarpetas.push(ruta); continue; }
      if (!e.isFile() || !esMedia(e.name)) continue;
      if (archivos.length >= limite) { cortado = true; return; }
      const info = await fsp.stat(ruta).catch(() => null);
      if (!info) continue;
      const conocido = yaEsta(e.name, info.size);
      archivos.push({
        ruta, nombre: e.name, tamano: info.size, modificado: info.mtime.toISOString(),
        tipo: esVideo(e.name) ? "video" : esFoto(e.name) ? "foto" : "otro",
        nuevo: !conocido,
      });
    }
    for (const sub of subcarpetas) await baja(sub, nivel + 1);
  }

  await baja(raiz, 0);
  archivos.sort((a, b) => String(b.modificado).localeCompare(String(a.modificado)));
  return { archivos, cortado, limite };
}

/** Carpetas de partida razonables cuando no hay ninguna unidad conectada. */
export function carpetasDelUsuario() {
  const casa = os.homedir();
  const candidatas = [
    { ruta: casa, etiqueta: "Carpeta personal" },
    { ruta: path.join(casa, "Desktop"), etiqueta: "Escritorio" },
    { ruta: path.join(casa, "Escritorio"), etiqueta: "Escritorio" },
    { ruta: path.join(casa, "Downloads"), etiqueta: "Descargas" },
    { ruta: path.join(casa, "Descargas"), etiqueta: "Descargas" },
    { ruta: path.join(casa, "Pictures"), etiqueta: "Imágenes" },
    { ruta: path.join(casa, "Imágenes"), etiqueta: "Imágenes" },
    { ruta: path.join(casa, "Videos"), etiqueta: "Vídeos" },
  ];
  const vistas = new Set();
  return candidatas.filter((c) => fs.existsSync(c.ruta) && !vistas.has(c.ruta) && vistas.add(c.ruta));
}
