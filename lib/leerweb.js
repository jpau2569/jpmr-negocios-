// ============================================================================
//  Lector de páginas web para Clara (herramienta leer_web)
// ----------------------------------------------------------------------------
//  Pau pega un enlace (un anuncio de Idealista, una oferta de empleo, una
//  noticia, la web de un competidor) y Clara lo lee de verdad en vez de
//  imaginarlo. Solo páginas públicas: se bloquean direcciones internas o
//  privadas (localhost, 10.x, 192.168.x, metadatos de la nube…) en cada salto
//  de redirección, hay tiempo máximo, tamaño máximo y solo se aceptan textos.
// ============================================================================

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 15000;
const MAX_BYTES = 2_000_000;
const MAX_CHARS = 15000;
const MAX_REDIRECCIONES = 3;

// true si la IP es de loopback, red privada, enlace local, CGNAT, multicast…
export function esIpPrivada(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    const mapeada = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeada) return esIpPrivada(mapeada[1]);
    return (
      x === "::" || x === "::1" ||
      x.startsWith("fc") || x.startsWith("fd") ||
      /^fe[89ab]/.test(x) || x.startsWith("ff")
    );
  }
  return true; // lo que no es IP válida no se considera seguro
}

async function comprobarDestino(u, resolver) {
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("solo se pueden leer enlaces http o https");
  }
  if (u.username || u.password) throw new Error("el enlace no puede llevar usuario ni contraseña");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("puerto no permitido");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("no se pueden leer direcciones internas");
  }
  const ips = isIP(host) ? [host] : (await resolver(host)).map((r) => r.address);
  if (!ips.length || ips.some(esIpPrivada)) throw new Error("no se pueden leer direcciones internas o privadas");
}

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", ntilde: "ñ", Ntilde: "Ñ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", uuml: "ü", iexcl: "¡", iquest: "¿", ordm: "º", ordf: "ª", sup2: "²", middot: "·" };

// Convierte HTML en texto legible: fuera scripts/estilos/menús, bloques en líneas.
export function htmlATexto(html) {
  const titulo = (String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const texto = String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTIDADES[n] ?? m)
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const t = titulo.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").replace(/&amp;/g, "&").trim();
  return { titulo: t, texto };
}

export async function leerWeb(enlace, { resolver = (h) => lookup(h, { all: true }) } = {}) {
  let url;
  try {
    url = new URL(String(enlace || "").trim());
  } catch {
    return "El enlace no es válido. Pídele a Pau la dirección completa (empezando por https://).";
  }

  try {
    let resp;
    for (let salto = 0; ; salto++) {
      await comprobarDestino(url, resolver);
      const ctrl = new AbortController();
      const alarma = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        resp = await fetch(url, {
          redirect: "manual",
          signal: ctrl.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ClaraAsistente/1.0; +https://www.asesoriacastresana.com)",
            Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5",
            "Accept-Language": "es-ES,es;q=0.9",
          },
        });
      } finally {
        clearTimeout(alarma);
      }
      if (resp.status >= 300 && resp.status < 400 && resp.headers.get("location")) {
        if (salto >= MAX_REDIRECCIONES) return "La página redirige demasiadas veces; no se pudo leer.";
        url = new URL(resp.headers.get("location"), url);
        continue;
      }
      break;
    }

    if (!resp.ok) {
      if (resp.status === 403 || resp.status === 429) {
        return `La web ${url.hostname} bloquea la lectura automática (${resp.status}). Pídele a Pau que copie y pegue el texto del anuncio o la página.`;
      }
      return `No se pudo leer la página (${resp.status}). Pídele a Pau que pegue el contenido.`;
    }

    const tipo = (resp.headers.get("content-type") || "").toLowerCase();
    if (tipo && !/text\/|html|json|xml/.test(tipo)) {
      return `El enlace no es una página de texto (${tipo.split(";")[0]}). Si es una foto o un PDF, pídele a Pau que lo adjunte con el clip 📎.`;
    }
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return "La página es demasiado grande para leerla entera; pídele a Pau el fragmento que le interesa.";
    const bruto = new TextDecoder("utf-8").decode(buf);

    const { titulo, texto } = /html|xml/.test(tipo) || /<html|<body/i.test(bruto.slice(0, 2000))
      ? htmlATexto(bruto)
      : { titulo: "", texto: bruto.trim() };
    if (!texto) {
      return "La página no tiene texto legible (probablemente se genera con JavaScript). Pídele a Pau que copie y pegue el contenido.";
    }
    const recorte = texto.length > MAX_CHARS ? texto.slice(0, MAX_CHARS) + "\n\n[…texto recortado…]" : texto;
    return `Página leída: ${url.href}${titulo ? `\nTítulo: ${titulo}` : ""}\n\n${recorte}`;
  } catch (e) {
    if (e?.name === "AbortError") return "La página tardó demasiado en responder. Pídele a Pau que pegue el contenido.";
    return "No se pudo leer el enlace: " + String(e?.message || e);
  }
}
