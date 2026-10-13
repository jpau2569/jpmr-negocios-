// ============================================================================
//  Lector de las fotos de una ficha de inmueble
// ----------------------------------------------------------------------------
//  Saca todas las fotos de la página de un inmueble de asesoriacastresana.com
//  (plantilla Inmoweb, CDN apinmo.com). Lo usan:
//   - api/fotos.js                              → la galería del escaparate 3D
//   - escaparate3d/herramientas/sincronizar.mjs → descarga a fotos propias
//
//  Es a propósito conservador: solo acepta imágenes de los dominios del portal,
//  descarta logos e iconos y, si el CDN sirve la misma foto en varios tamaños
//  con sufijo (-p, -g…), se queda con la mayor. Si la plantilla cambia y no
//  encuentra nada, devuelve lista vacía y quien llama usa la foto que ya tenía.
// ============================================================================

const EXTENSION = /\.(jpe?g|png|webp|avif)(\?|$)/i;
const DESCARTA = /(logo|icono|icon|sprite|placeholder|avatar|whatsapp|facebook|instagram|twitter|bandera|flag|pixel|blank|banner|cabecera)/i;
const DOMINIOS = [/(^|\.)apinmo\.com$/i, /(^|\.)asesoriacastresana\.com$/i];
// Las fichas actuales de Inmoweb sirven las fotos desde Google Cloud Storage,
// pero solo dentro de la carpeta del portal: el resto de ese dominio no vale.
const INMOWEB_GCS = (u) => u.hostname === "storage.googleapis.com" && u.pathname.startsWith("/static.inmoweb.es/");
// Foto de un inmueble en Inmoweb: /property/<id>/image/[thumb/585_335/|w/]archivo.
// Ahí el nombre lo pone quien sube la foto («WhatsApp Image…»), así que no se
// filtra por palabras sueltas como «whatsapp».
const FOTO_INMOWEB = /\/property\/\d+\/image\/(?:(thumb\/\d+_\d+|w)\/)?[^/]+$/i;
const ATRIBUTOS = /(?:src|data-src|data-lazy|data-original|data-large|data-imagen|data-image|data-full|href)\s*=\s*["']([^"'\s]+)["']/gi;

// Sufijos de tamaño más habituales, de mayor a menor. Sin sufijo se considera
// el original y gana a todos.
const TAMANOS = ["xl", "g", "l", "h", "b", "m", "s", "p", "t"];

function agrupa(url) {
  const u = new URL(url);
  const inmoweb = u.pathname.match(FOTO_INMOWEB);
  if (inmoweb) {
    // La misma foto va en miniatura (thumb/585_335/) y a tamaño web (w/): gana «w» y luego el original.
    const clave = u.pathname.replace(/\/image\/(?:thumb\/\d+_\d+|w)\//i, "/image/");
    return { clave, rango: inmoweb[1] ? (inmoweb[1].toLowerCase() === "w" ? 0 : 5) : -1 };
  }
  const archivo = u.pathname.split("/").pop();
  const sinExtension = archivo.replace(EXTENSION, "");
  const marca = sinExtension.match(/[-_](xl|g|l|h|b|m|s|p|t|thumb|small|big|grande|peque\w*)$/i);
  const base = marca ? sinExtension.slice(0, -marca[0].length) : sinExtension;
  const rango = marca ? TAMANOS.indexOf(marca[1].toLowerCase()) : -1;
  return { clave: u.pathname.replace(archivo, base), rango: rango < 0 ? -1 : rango };
}

export function extraeFotos(html, base = "https://www.asesoriacastresana.com", maximo = 20) {
  const porClave = new Map();
  const orden = [];

  for (const m of String(html || "").matchAll(ATRIBUTOS)) {
    const bruto = m[1].trim();
    if (!EXTENSION.test(bruto)) continue;
    let url;
    try { url = new URL(bruto, base); } catch { continue; }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (!DOMINIOS.some((re) => re.test(url.hostname)) && !INMOWEB_GCS(url)) continue;
    if (DESCARTA.test(FOTO_INMOWEB.test(url.pathname) ? url.pathname.replace(/[^/]+$/, "") : bruto)) continue;

    const { clave, rango } = agrupa(url.href);
    const previo = porClave.get(clave);
    if (!previo) {
      porClave.set(clave, { url: url.href, rango });
      orden.push(clave);
    } else if (rango < previo.rango) {
      // Misma foto en tamaño mayor: se queda con esta, en el sitio de la otra.
      porClave.set(clave, { url: url.href, rango });
    }
  }

  return orden.map((c) => porClave.get(c).url).slice(0, maximo);
}
