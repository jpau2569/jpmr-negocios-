// ============================================================================
//  Lector de cartera desde la web de la agencia
// ----------------------------------------------------------------------------
//  Portado del lector que ya funciona en el monorepo (lib/cartera.js), con dos
//  cambios que importan:
//
//    1. NO está atado a asesoriacastresana.com. El dominio y las rutas entran
//       por parámetro, porque la gracia del producto es que la siguiente
//       agencia sea un alta de cinco minutos y no un proyecto nuevo.
//
//    2. Devuelve inmuebles ya normalizados al modelo de `properties`, no la
//       forma del escaparate 3D.
//
//  Este archivo es PURO: analiza y normaliza, no sale a la red. Por eso se
//  puede probar de verdad contra un HTML de muestra sin tocar internet. Salir
//  a buscar la página es cosa de lib/cartera/index.ts, que sí es server-only.
//
//  Qué NO hace, a propósito: inventarse lo que la web no dice. El listado
//  público de una web Inmoweb no lleva certificado energético, así que todo lo
//  que sale de aquí nace con `energy_status: "pendiente"` y la ficha lo canta.
//  El RD 390/2021 obliga a mostrar la etiqueta en el anuncio; rellenarla a ojo
//  sería peor que dejarla vacía.
// ============================================================================

import type {
  EstadoEnergia, OperacionInmueble, TipoInmueble,
} from "@/types/negocio";

/** Un inmueble tal y como se lee de la web, antes de tocar la base. */
export interface InmuebleLeido {
  reference: string;
  slug: string;
  title: string;
  description: string | null;
  operation: OperacionInmueble;
  kind: TipoInmueble;
  price_cents: number | null;
  surface_built_m2: number | null;
  rooms: number | null;
  bathrooms: number | null;
  municipality: string | null;
  energy_status: EstadoEnergia;
  source_url: string;
  foto: string | null;
}

// Las webs del sector vienen llenas de entidades HTML sin decodificar. Sin
// esto, "Cudillero" sale como "Cudill&eacute;ro" en el cartel impreso.
const ENTIDADES: [RegExp, string][] = [
  [/&aacute;/g, "á"], [/&eacute;/g, "é"], [/&iacute;/g, "í"],
  [/&oacute;/g, "ó"], [/&uacute;/g, "ú"], [/&ntilde;/g, "ñ"],
  [/&Aacute;/g, "Á"], [/&Eacute;/g, "É"], [/&Iacute;/g, "Í"],
  [/&Oacute;/g, "Ó"], [/&Uacute;/g, "Ú"], [/&Ntilde;/g, "Ñ"],
  [/&uuml;/g, "ü"], [/&ordm;/g, "º"], [/&ordf;/g, "ª"],
  [/&nbsp;/g, " "], [/&amp;/g, "&"], [/&quot;/g, '"'], [/&#39;/g, "'"],
  // Sin esto el precio se pierde: muchas plantillas escriben &euro; y no €,
  // y un piso sin precio en el escaparate no lo mira nadie.
  [/&euro;/g, "€"], [/&sup2;/g, "²"], [/&middot;/g, "·"], [/&deg;/g, "°"],
];

/**
 * Minúsculas y sin acentos, para poder comparar con expresiones regulares
 * ASCII. Existe por un motivo concreto: en JavaScript `\b` se define sobre
 * [A-Za-z0-9_], así que la `á` queda fuera y /\bático/ NO casa con "ático".
 * Normalizar una vez es más seguro que acordarse del detalle en cada patrón.
 */
function sinAcentos(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function limpiarTexto(t: string | null | undefined): string {
  let s = (t ?? "").replace(/<[^>]+>/g, " ");
  for (const [de, a] of ENTIDADES) s = s.replace(de, a);
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Tipo de inmueble a partir del título. Conservador a propósito: si no lo
 * reconoce devuelve "otro" en vez de suponer "piso". Un garaje anunciado como
 * piso es un problema con el cliente, no un detalle.
 */
export function tipoDesdeTitulo(titulo: string): TipoInmueble {
  // Ojo: se normaliza ANTES de comparar. Con el título tal cual, /\bático/ no
  // casaría nunca (ver sinAcentos). Por eso los patrones son todos ASCII.
  const t = sinAcentos(titulo);
  const reglas: [RegExp, TipoInmueble][] = [
    [/\baticos?\b/, "atico"],
    [/\bduplex\b/, "duplex"],
    [/\bestudios?\b|\bloft\b/, "estudio"],
    [/\bchalets?\b|\badosados?\b|\bpareados?\b/, "chalet"],
    [/\bcasas?\b|\bcaserias?\b|\bquintanas?\b/, "casa"],
    [/\blocal(es)?\b/, "local"],
    [/\boficinas?\b|\bdespachos?\b/, "oficina"],
    [/\bnaves?\b|\bindustrial\b/, "nave"],
    [/\bgarajes?\b|\bplazas? de garaje\b|\bcocheras?\b/, "garaje"],
    [/\btrasteros?\b/, "trastero"],
    [/\bterrenos?\b|\bfincas?\b|\bparcelas?\b|\bsuelo\b/, "terreno"],
    [/\bedificios?\b/, "edificio"],
    [/\bpisos?\b|\bapartamentos?\b|\bviviendas?\b/, "piso"],
  ];
  for (const [re, tipo] of reglas) if (re.test(t)) return tipo;
  return "otro";
}

/** Municipio a partir de "Piso en Oviedo" / "Chalet en Mieres del Camín". */
export function municipioDesdeTitulo(titulo: string): string | null {
  const m = titulo.match(/\ben\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñü.'-]*(?:\s+(?:de|del|la|las|los|el)\s+[\wáéíóúñü.'-]+|\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñü.'-]+)*)/);
  return m?.[1] ? m[1].trim() : null;
}

/** Trozo de URL estable y legible. */
export function slugDeInmueble(titulo: string, referencia: string): string {
  const base = titulo
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  const ref = referencia
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return ref || "inmueble";
  return `${base}-${ref}`;
}

function tituloDesdeSlug(slug: string): string {
  const palabras = slug.replace(/-es\d+$/, "").split("-").filter(Boolean);
  if (!palabras.length) return "Inmueble disponible";
  const frase = palabras.join(" ");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** "330.000 €", "330000€", "1.250 €/mes" → céntimos. */
export function parsearPrecioCents(trozo: string): number | null {
  const m = trozo.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,9})\s*€/);
  if (!m?.[1]) return null;
  const n = parseInt(m[1].replace(/[.\s]/g, ""), 10);
  if (!Number.isFinite(n) || n < 100) return null;
  return n * 100;
}

function parsearFoto(trozo: string, base: string): string | null {
  const imgs = [...trozo.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((s): s is string => Boolean(s));
  for (const src of imgs) {
    const s = src.toLowerCase();
    if (s.includes("logo") || s.includes("icon") || s.endsWith(".svg")) continue;
    if (s.includes("apinmo") || s.includes("foto") || /\.(jpe?g|png|webp)(\?|$)/.test(s)) {
      try {
        return new URL(src, base).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Extrae los inmuebles de una página de resultados.
 *
 * Estructura real de las tarjetas Inmoweb:
 *   <div class="venta" data-url="..." title="Oviedo" id="1762095"> ... data-ref="PIS0210"
 *   <h4 class="subTitulo">... <a title="Piso en Oviedo">Piso en Oviedo</a></h4>
 *   <p class="descripcion ocultar"> Tu nuevo hogar ... </p>
 *   <li class="habitaciones">...<span>Habitaciones:</span> 4</li>
 *   <li class="supConstruida">...<span>Sup. Construida:</span> 165 m²</li>
 *   <div class="precio"><p><span class="actual"> 780.000€ </span></p></div>
 *
 * Con regex genéricos de reserva por si cambian la plantilla: si el día de
 * mañana la web cambia, es preferible leer de menos que leer mal.
 */
export function parsearInmuebles(
  html: string,
  operacion: OperacionInmueble,
  base: string,
): InmuebleLeido[] {
  const items: InmuebleLeido[] = [];

  // Una misma ficha enlaza varias veces (foto + título): se agrupan por
  // referencia consecutiva para delimitar dónde empieza y acaba cada tarjeta.
  const enlaces = [...html.matchAll(
    /(?:href|data-url|data-enlace)=["']([^"']*?([a-z0-9-]+)-es(\d+)\.html)[^"']*["']/gi,
  )];

  const grupos: { ref: string; href: string; slug: string; inicio: number }[] = [];
  for (const m of enlaces) {
    const href = m[1], slug = m[2], ref = m[3];
    if (!href || !slug || !ref || m.index === undefined) continue;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.ref === ref) continue;
    grupos.push({ ref, href, slug, inicio: m.index });
  }

  const vistos = new Set<string>();
  for (let i = 0; i < grupos.length; i += 1) {
    const g = grupos[i];
    if (!g || vistos.has(g.ref)) continue;
    vistos.add(g.ref);

    const siguiente = grupos[i + 1];
    const fin = siguiente ? siguiente.inicio : Math.min(html.length, g.inicio + 5000);
    const trozo = html.slice(g.inicio, fin);
    const texto = limpiarTexto(trozo);

    const conTitle =
      trozo.match(/<a[^>]+title=["']([^"']{6,120})["'][^>]*href=["'][^"']*-es\d+\.html/i)
      ?? trozo.match(/href=["'][^"']*-es\d+\.html[^"']*["'][^>]*title=["']([^"']{6,120})["']/i);

    const m2 = texto.match(/Sup\.?\s*Construida:\s*(\d{2,4})/i)
      ?? texto.match(/(\d{2,4})\s*m(?:2|²)?(?![\w²])/i);
    const hab = texto.match(/Habitaciones:\s*(\d{1,2})/i)
      ?? texto.match(/(\d{1,2})\s*(?:hab\b|dormitorio)/i);
    const banos = texto.match(/(?:Baños|Aseos):\s*(\d{1,2})/i)
      ?? texto.match(/(\d{1,2})\s*(?:baño|aseo)/i);

    // El € puede venir literal o como entidad, según la plantilla.
    const precioActual = trozo.match(/class=["']actual["'][^>]*>\s*([\d.,\s]+)\s*(?:€|&euro;)/i);
    const refComercial = trozo.match(/data-ref=["']([^"']{2,20})["']/i)
      ?? trozo.match(/class=["']numeroRef["']\s*>\s*([^<]{2,20})</i);
    const localidad = trozo.match(/<h3>\s*([^<]{2,60})\s*<\/h3>/i);
    const descripcion = trozo.match(/class=["']descripcion[^"']*["']\s*>\s*([^<]{20,400})/i);

    let url: string;
    try {
      url = new URL(g.href, base).href;
    } catch {
      continue;
    }

    const titulo = conTitle?.[1]
      ? limpiarTexto(conTitle[1])
      : tituloDesdeSlug(`${g.slug}-es${g.ref}`);
    const referencia = refComercial?.[1] ? limpiarTexto(refComercial[1]) : `es${g.ref}`;

    const enteroONull = (m: RegExpMatchArray | null): number | null => {
      if (!m?.[1]) return null;
      const n = parseInt(m[1], 10);
      return Number.isFinite(n) ? n : null;
    };

    items.push({
      reference: referencia,
      slug: slugDeInmueble(titulo, referencia),
      title: titulo,
      description: descripcion?.[1]
        ? limpiarTexto(descripcion[1]).replace(/\.\.\.$/, "").slice(0, 300)
        : null,
      operation: operacion,
      kind: tipoDesdeTitulo(titulo),
      price_cents: precioActual?.[1]
        ? parsearPrecioCents(`${precioActual[1]}€`)
        : parsearPrecioCents(texto),
      surface_built_m2: enteroONull(m2),
      rooms: enteroONull(hab),
      bathrooms: enteroONull(banos),
      municipality: localidad?.[1] ? limpiarTexto(localidad[1]) : municipioDesdeTitulo(titulo),
      // La web no publica la etiqueta energética en el listado. No se inventa.
      energy_status: "pendiente",
      source_url: url,
      foto: parsearFoto(trozo, base),
    });
  }

  return items;
}
