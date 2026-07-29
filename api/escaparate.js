// Escaparate Castresana: lee los inmuebles publicados en www.asesoriacastresana.com
// y los devuelve como JSON para la pantalla del escaparate (escaparate.html).
// No usa ninguna clave: escrapea las páginas públicas de resultados del propio portal.

const BASE = "https://www.asesoriacastresana.com";

// Páginas de resultados a leer (venta y alquiler). od=pri.d = ordenado por precio desc.
const FUENTES = [
  { operacion: "venta", url: `${BASE}/results/?id_tipo_operacion=1&od=pri.d&i=0&c=45` },
  { operacion: "alquiler", url: `${BASE}/results/?id_tipo_operacion=2&od=pri.d&i=0&c=45` },
];

const CABECERAS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

function limpiarTexto(t) {
  return (t || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&ntilde;/g, "ñ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tituloDesdeSlug(slug) {
  const sinRef = slug.replace(/-es\d+$/, "").replace(/^\/+/, "");
  const palabras = sinRef.split("-").filter(Boolean);
  if (!palabras.length) return "Inmueble disponible";
  const frase = palabras.join(" ");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

function parsearPrecio(trozo) {
  // Admite "330.000 €", "330000€", "1.250 €/mes"...
  const m = trozo.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,7})\s*€/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.\s]/g, ""), 10);
  return Number.isFinite(n) && n >= 100 ? n : null;
}

function parsearFoto(trozo) {
  const imgs = [...trozo.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const src of imgs) {
    const s = src.toLowerCase();
    if (s.includes("logo") || s.includes("icon") || s.endsWith(".svg")) continue;
    if (s.includes("apinmo") || s.includes("foto") || /\.(jpe?g|png|webp)(\?|$)/.test(s)) {
      try {
        return new URL(src, BASE).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

function parsearInmuebles(html, operacion) {
  const items = [];
  // Cada ficha enlaza a una URL tipo "piso-en-oviedo-con-ascensor-es1616045.html".
  // Una misma ficha puede tener varios enlaces (foto + título): los agrupamos por
  // referencia consecutiva para delimitar bien dónde empieza y acaba cada tarjeta.
  const enlaces = [...html.matchAll(/href=["']([^"']*?([a-z0-9-]+)-es(\d+)\.html)[^"']*["']/gi)];
  const grupos = [];
  for (const m of enlaces) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.ref === m[3]) continue;
    grupos.push({ ref: m[3], href: m[1], slug: m[2], inicio: m.index });
  }

  const vistos = new Set();
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];
    if (vistos.has(g.ref)) continue;
    vistos.add(g.ref);

    // La tarjeta va desde su primer enlace hasta el primer enlace de la ficha siguiente.
    const inicio = g.inicio;
    const fin = i + 1 < grupos.length ? grupos[i + 1].inicio : Math.min(html.length, g.inicio + 5000);
    const trozo = html.slice(inicio, fin);
    const texto = limpiarTexto(trozo);

    // Título: atributo title del enlace si existe; si no, lo montamos desde el slug.
    const conTitle = trozo.match(/<a[^>]+title=["']([^"']{6,120})["'][^>]*href=["'][^"']*-es\d+\.html/i) ||
      trozo.match(/href=["'][^"']*-es\d+\.html[^"']*["'][^>]*title=["']([^"']{6,120})["']/i);

    const m2 = texto.match(/(\d{2,4})\s*m(?:2|²)?(?![\w²])/i);
    const hab = texto.match(/(\d{1,2})\s*(?:hab|dorm)/i);
    const banos = texto.match(/(\d{1,2})\s*(?:bañ|aseo)/i);

    let url;
    try {
      url = new URL(g.href, BASE).href;
    } catch {
      continue;
    }

    items.push({
      ref: `es${g.ref}`,
      operacion,
      titulo: conTitle ? limpiarTexto(conTitle[1]) : tituloDesdeSlug(g.slug + "-es" + g.ref),
      precio: parsearPrecio(texto),
      m2: m2 ? parseInt(m2[1], 10) : null,
      habitaciones: hab ? parseInt(hab[1], 10) : null,
      banos: banos ? parseInt(banos[1], 10) : null,
      foto: parsearFoto(trozo),
      url,
    });
  }
  return items;
}

export default async function handler(_req, res) {
  const items = [];
  const errores = [];

  for (const fuente of FUENTES) {
    try {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), 12000);
      const respuesta = await fetch(fuente.url, { headers: CABECERAS, signal: controlador.signal });
      clearTimeout(temporizador);
      if (!respuesta.ok) {
        errores.push(`${fuente.operacion}: HTTP ${respuesta.status}`);
        continue;
      }
      const html = await respuesta.text();
      items.push(...parsearInmuebles(html, fuente.operacion));
    } catch (e) {
      errores.push(`${fuente.operacion}: ${e.message}`);
    }
  }

  // Caché en el CDN de Vercel: 30 min fresco, hasta 1 día servible mientras revalida.
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    ok: items.length > 0,
    actualizado: new Date().toISOString(),
    total: items.length,
    errores: errores.length ? errores : undefined,
    items,
  });
}
