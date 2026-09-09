// ============================================================================
//  Cartera de Asesoría Castresana — lector compartido
// ----------------------------------------------------------------------------
//  Lee los inmuebles publicados en www.asesoriacastresana.com (páginas públicas
//  de resultados, sin claves) y los devuelve normalizados. Lo usan:
//   - api/escaparate.js → la pantalla de la TV del local
//   - api/clara.js      → la herramienta "mi_cartera" de Clara
//   - api/briefing.js   → el briefing diario proactivo
// ============================================================================

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

export function parsearInmuebles(html, operacion) {
  const items = [];
  // Cada ficha enlaza a una URL tipo "piso-en-oviedo-con-ascensor-es1616045.html".
  // Una misma ficha puede tener varios enlaces (foto + título): los agrupamos por
  // referencia consecutiva para delimitar bien dónde empieza y acaba cada tarjeta.
  // La tarjeta abre con data-url="...", así que lo contamos como marcador junto a href
  // para que el trozo incluya la cabecera de la tarjeta (data-ref, etiquetas, etc.).
  const enlaces = [...html.matchAll(/(?:href|data-url|data-enlace)=["']([^"']*?([a-z0-9-]+)-es(\d+)\.html)[^"']*["']/gi)];
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

    // Estructura real de las tarjetas Inmoweb de asesoriacastresana.com:
    //   <div class="venta" data-url="..." title="Oviedo" id="1762095"> ... data-ref="PIS0210"
    //   <h4 class="subTitulo">... <a title="Piso en Oviedo">Piso en Oviedo</a></h4>
    //   <p class="descripcion ocultar"> Tu nuevo hogar ... </p>
    //   <li class="habitaciones">...<span>Habitaciones:</span> 4</li>
    //   <li class="banos">...<span>Baños:</span> 2</li>
    //   <li class="supConstruida">...<span>Sup. Construida:</span> 165 m²</li>
    //   <div class="precio"><p><span class="actual"> 780.000€ </span></p></div>
    // Con regex genéricos de reserva por si cambian la plantilla.
    const conTitle = trozo.match(/<a[^>]+title=["']([^"']{6,120})["'][^>]*href=["'][^"']*-es\d+\.html/i) ||
      trozo.match(/href=["'][^"']*-es\d+\.html[^"']*["'][^>]*title=["']([^"']{6,120})["']/i);

    const m2 = texto.match(/Sup\.?\s*Construida:\s*(\d{2,4})/i) || texto.match(/(\d{2,4})\s*m(?:2|²)?(?![\w²])/i);
    const hab = texto.match(/Habitaciones:\s*(\d{1,2})/i) || texto.match(/(\d{1,2})\s*(?:hab\b|dormitorio)/i);
    const banos = texto.match(/(?:Baños|Aseos):\s*(\d{1,2})/i) || texto.match(/(\d{1,2})\s*(?:baño|aseo)/i);

    const precioActual = trozo.match(/class=["']actual["'][^>]*>\s*([\d.,\s]+)\s*€/i);
    const refComercial = trozo.match(/data-ref=["']([^"']{2,20})["']/i) ||
      trozo.match(/class=["']numeroRef["']\s*>\s*([^<]{2,20})</i);
    const localidad = trozo.match(/<h3>\s*([^<]{2,60})\s*<\/h3>/i);
    const descripcion = trozo.match(/class=["']descripcion[^"']*["']\s*>\s*([^<]{20,400})/i);

    let url;
    try {
      url = new URL(g.href, BASE).href;
    } catch {
      continue;
    }

    items.push({
      ref: refComercial ? limpiarTexto(refComercial[1]) : `es${g.ref}`,
      operacion,
      titulo: conTitle ? limpiarTexto(conTitle[1]) : tituloDesdeSlug(g.slug + "-es" + g.ref),
      localidad: localidad ? limpiarTexto(localidad[1]) : null,
      descripcion: descripcion ? limpiarTexto(descripcion[1]).replace(/\.\.\.$/, "").slice(0, 160) : null,
      precio: precioActual ? parsearPrecio(precioActual[1] + "€") : parsearPrecio(texto),
      m2: m2 ? parseInt(m2[1], 10) : null,
      habitaciones: hab ? parseInt(hab[1], 10) : null,
      banos: banos ? parseInt(banos[1], 10) : null,
      foto: parsearFoto(trozo),
      url,
    });
  }
  return items;
}

// Lee la cartera completa (venta + alquiler) de la web oficial.
export async function obtenerCartera() {
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

  return { items, errores };
}

// Resumen en texto plano de la cartera, pensado para dárselo a Clara como
// resultado de la herramienta "mi_cartera".
export function resumenCartera(items, errores = []) {
  if (!items.length) {
    return (
      "Ahora mismo no he podido leer la cartera de asesoriacastresana.com." +
      (errores.length ? ` Errores: ${errores.join("; ")}.` : "") +
      " Dile a Pau que puede pegar los datos del inmueble a mano."
    );
  }
  const linea = (it, i) => {
    const partes = [
      `${i + 1}. [${it.operacion === "alquiler" ? "ALQUILER" : "VENTA"}] ${it.titulo}`,
      it.precio ? `${it.precio.toLocaleString("es-ES")} €${it.operacion === "alquiler" ? "/mes" : ""}` : "precio a consultar",
    ];
    if (it.m2) partes.push(`${it.m2} m²`);
    if (it.habitaciones) partes.push(`${it.habitaciones} hab.`);
    if (it.banos) partes.push(`${it.banos} baño${it.banos > 1 ? "s" : ""}`);
    if (it.localidad) partes.push(it.localidad);
    partes.push(`ref ${it.ref}`);
    partes.push(it.url);
    return partes.join(" · ");
  };
  const venta = items.filter((i) => i.operacion === "venta");
  const alquiler = items.filter((i) => i.operacion === "alquiler");
  return (
    `Cartera actual de Asesoría Castresana (${items.length} inmuebles: ${venta.length} en venta, ${alquiler.length} en alquiler), leída ahora mismo de www.asesoriacastresana.com:\n\n` +
    items.map(linea).join("\n") +
    (errores.length ? `\n\nAvisos: ${errores.join("; ")}.` : "")
  );
}
