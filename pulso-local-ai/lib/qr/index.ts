// ============================================================================
//  QR: SVG, PNG y carteles imprimibles
// ----------------------------------------------------------------------------
//  Sin dependencias externas. El codificador QR es el de Fotos Fáciles, ya
//  verificado; aquí sólo se le pone ropa: SVG para la web, PNG para quien
//  quiera pegarlo en un cartel de Word, y dos piezas listas para imprimir —
//  un A5 para el escaparate y una pegatina pequeña para mesa o barra.
//
//  Nivel de corrección: Q por defecto, no M. Un QR pegado en una mesa de bar
//  acaba con una gota de sidra encima, y Q aguanta hasta un 25% de daño.
// ============================================================================

import { deflateSync } from "node:zlib";
import { matriz, svg as svgNucleo, type NivelCorreccion } from "./nucleo.mjs";

export type { NivelCorreccion };

export interface OpcionesQr {
  nivel?: NivelCorreccion;
  margen?: number;
  claro?: string;
  oscuro?: string;
}

/** QR en SVG, escalable sin pérdida: es lo que debe ir a imprenta. */
export function qrSvg(texto: string, opciones: OpcionesQr = {}): string {
  const { nivel = "Q", margen = 4, claro = "#ffffff", oscuro = "#000000" } = opciones;
  return svgNucleo(texto, { nivel, margen, claro, oscuro });
}

/* --- PNG --------------------------------------------------------------------
   Se escribe a mano (cabecera, IHDR, IDAT, IEND) porque meter una dependencia
   de imagen para pintar cuadrados negros no tiene sentido. Escala de grises de
   8 bits: es el formato más pequeño para un QR y lo abre cualquier programa. */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Buffer): number {
  let c = 0xffffffff;
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, crc]);
}

/**
 * QR en PNG.
 * @param escala píxeles por módulo. 8 da un PNG nítido para pantalla y papel.
 */
export function qrPng(texto: string, opciones: OpcionesQr & { escala?: number } = {}): Buffer {
  const { nivel = "Q", margen = 4, escala = 8 } = opciones;
  const { tamano, modulos } = matriz(texto, { nivel });

  const lado = (tamano + margen * 2) * escala;
  // Cada fila del PNG lleva un byte de filtro delante (0 = sin filtro).
  const crudo = Buffer.alloc((lado + 1) * lado, 0xff);

  for (let y = 0; y < lado; y += 1) {
    const inicioFila = y * (lado + 1);
    crudo[inicioFila] = 0;
    const filaModulo = Math.floor(y / escala) - margen;
    if (filaModulo < 0 || filaModulo >= tamano) continue;
    const fila = modulos[filaModulo]!;
    for (let x = 0; x < lado; x += 1) {
      const colModulo = Math.floor(x / escala) - margen;
      if (colModulo < 0 || colModulo >= tamano) continue;
      if (fila[colModulo]) crudo[inicioFila + 1 + x] = 0x00;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8;   // bits por muestra
  ihdr[9] = 0;   // tipo de color 0: escala de grises
  ihdr[10] = 0;  // compresión deflate
  ihdr[11] = 0;  // filtrado estándar
  ihdr[12] = 0;  // sin entrelazado

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

/* --- Carteles ----------------------------------------------------------------
   SVG con las medidas reales del papel, para que al imprimir salga a tamaño y
   no "ajustado a la página". */

export interface DatosCartel {
  /** Lo que codifica el QR. */
  url: string;
  negocio: string;
  /** "Menú del día", "Mesa 7"… */
  titulo: string;
  /** La frase que hace que la gente escanee. */
  reclamo?: string;
  pie?: string;
  colorFondo?: string;
  colorTinta?: string;
  colorAcento?: string;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** El QR sin el envoltorio <svg>, para incrustarlo dentro del cartel. */
function qrIncrustado(url: string, x: number, y: number, lado: number, tinta: string): string {
  const { tamano, modulos } = matriz(url, { nivel: "Q" });
  const margen = 4;
  const total = tamano + margen * 2;
  const paso = lado / total;
  let ruta = "";
  for (let f = 0; f < tamano; f += 1) {
    for (let c = 0; c < tamano; c += 1) {
      if (modulos[f]![c]) {
        const px = x + (c + margen) * paso;
        const py = y + (f + margen) * paso;
        ruta += `M${px.toFixed(2)} ${py.toFixed(2)}h${paso.toFixed(2)}v${paso.toFixed(2)}h-${paso.toFixed(2)}z`;
      }
    }
  }
  return `<rect x="${x}" y="${y}" width="${lado}" height="${lado}" rx="6" fill="#ffffff"/>`
    + `<path d="${ruta}" fill="${tinta}"/>`;
}

/**
 * Cartel A5 (148 × 210 mm) para el escaparate o la pared.
 * Se imprime tal cual: las medidas van en milímetros.
 */
export function cartelA5(datos: DatosCartel): string {
  const {
    url, negocio, titulo,
    reclamo = "Escanea y míralo en tu móvil",
    pie = "",
    colorFondo = "#17181b", colorTinta = "#f3efe6", colorAcento = "#d4a03c",
  } = datos;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="148mm" height="210mm" viewBox="0 0 148 210">
  <rect width="148" height="210" fill="${colorFondo}"/>
  <rect x="6" y="6" width="136" height="198" rx="5" fill="none" stroke="${colorAcento}" stroke-width="0.6" opacity="0.5"/>

  <text x="74" y="26" text-anchor="middle" font-family="Georgia, serif" font-size="9" font-weight="bold" fill="${colorTinta}">${escapar(negocio)}</text>
  <text x="74" y="38" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="6.5" fill="${colorAcento}" letter-spacing="1.6">${escapar(titulo.toUpperCase())}</text>

  ${qrIncrustado(url, 29, 52, 90, "#000000")}

  <text x="74" y="160" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="7.5" font-weight="bold" fill="${colorTinta}">${escapar(reclamo)}</text>
  <text x="74" y="171" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="5" fill="${colorTinta}" opacity="0.65">Apunta con la cámara del móvil. No hace falta instalar nada.</text>
  ${pie ? `<text x="74" y="190" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="4.6" fill="${colorTinta}" opacity="0.5">${escapar(pie)}</text>` : ""}
</svg>`;
}

/** Lo que distingue el cartel de un inmueble del de un bar. */
export interface DatosCartelInmueble extends DatosCartel {
  /** "165.000 €" o "Consultar". Nunca un cero. */
  precio: string;
  /** "3 hab · 2 baños · 90 m²". Puede ir vacío si no se sabe nada. */
  resumen?: string;
  referencia?: string;
  /** Vendido, Reservado… Si va, se pinta en diagonal sobre el cartel. */
  sello?: string;
}

/**
 * Cartel A4 (210 × 297 mm) de UN inmueble, para el escaparate.
 *
 * Este es el que hace el trabajo de verdad: lo mira alguien de pie en la
 * calle, de noche, con la oficina cerrada. Por eso el precio va enorme (es lo
 * primero que busca cualquiera), el QR grande y bajo —a la altura cómoda para
 * apuntar con el móvil pegado al cristal— y el reclamo dice qué va a pasar si
 * escanea, no "escanéame".
 *
 * Que lleve QR PROPIO, y no uno general de la agencia, es lo que permite decir
 * después: "tu piso se ha visto 47 veces este mes, 12 con la oficina cerrada".
 */
export function cartelA4Inmueble(datos: DatosCartelInmueble): string {
  const {
    url, negocio, titulo, precio, resumen = "", referencia = "",
    reclamo = "Fotos, datos y pedir visita, en tu móvil",
    pie = "", sello = "",
    colorFondo = "#11161d", colorTinta = "#eef2f6", colorAcento = "#c9a227",
  } = datos;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">
  <rect width="210" height="297" fill="${colorFondo}"/>
  <rect x="8" y="8" width="194" height="281" rx="6" fill="none" stroke="${colorAcento}" stroke-width="0.7" opacity="0.5"/>

  <text x="105" y="30" text-anchor="middle" font-family="Georgia, serif" font-size="10" font-weight="bold" fill="${colorTinta}">${escapar(negocio)}</text>

  <text x="105" y="52" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="${colorTinta}">${escapar(recorte(titulo, 52))}</text>
  ${resumen ? `<text x="105" y="63" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="6.5" fill="${colorTinta}" opacity="0.7">${escapar(resumen)}</text>` : ""}

  <text x="105" y="90" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="22" font-weight="bold" fill="${colorAcento}">${escapar(precio)}</text>

  ${qrIncrustado(url, 55, 110, 100, "#000000")}

  <text x="105" y="232" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="9" font-weight="bold" fill="${colorTinta}">${escapar(reclamo)}</text>
  <text x="105" y="243" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="5.6" fill="${colorTinta}" opacity="0.65">Apunta con la cámara del móvil. No hace falta instalar nada.</text>
  ${referencia ? `<text x="105" y="258" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="5.2" fill="${colorTinta}" opacity="0.5">Ref. ${escapar(referencia)}</text>` : ""}
  ${pie ? `<text x="105" y="276" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="5" fill="${colorTinta}" opacity="0.45">${escapar(pie)}</text>` : ""}
  ${sello ? `<g transform="rotate(-18 105 150)" opacity="0.9">
    <rect x="42" y="135" width="126" height="30" rx="4" fill="none" stroke="${colorAcento}" stroke-width="2"/>
    <text x="105" y="156" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="17" font-weight="bold" letter-spacing="3" fill="${colorAcento}">${escapar(sello.toUpperCase())}</text>
  </g>` : ""}
</svg>`;
}

/** Corta sin partir una palabra por la mitad, que en un cartel canta. */
function recorte(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo);
  const espacio = corte.lastIndexOf(" ");
  return `${(espacio > maximo * 0.6 ? corte.slice(0, espacio) : corte).trimEnd()}…`;
}

/**
 * Pegatina de mesa o barra (70 × 90 mm). Pequeña, porque en una mesa de bar
 * compite con los platos: tiene que caber en un pie de metacrilato.
 */
export function cartelMesa(datos: DatosCartel): string {
  const {
    url, negocio, titulo,
    reclamo = "La carta, en tu móvil",
    colorFondo = "#17181b", colorTinta = "#f3efe6", colorAcento = "#d4a03c",
  } = datos;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="70mm" height="90mm" viewBox="0 0 70 90">
  <rect width="70" height="90" rx="4" fill="${colorFondo}"/>
  <text x="35" y="12" text-anchor="middle" font-family="Georgia, serif" font-size="5.4" font-weight="bold" fill="${colorTinta}">${escapar(negocio)}</text>
  <text x="35" y="19" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="3.4" fill="${colorAcento}" letter-spacing="1">${escapar(titulo.toUpperCase())}</text>
  ${qrIncrustado(url, 12.5, 24, 45, "#000000")}
  <text x="35" y="78" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="4.2" font-weight="bold" fill="${colorTinta}">${escapar(reclamo)}</text>
  <text x="35" y="84" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="2.9" fill="${colorTinta}" opacity="0.6">Apunta con la cámara</text>
</svg>`;
}

/** URL que codifica un QR, con su token para poder medir de dónde viene. */
/**
 * Token del QR de un inmueble.
 *
 * Lleva dentro un trozo del identificador del negocio por un motivo concreto:
 * `qr_codes.token` es único EN TODA la base, y dos agencias distintas usan
 * referencias como PIS0210 sin saber la una de la otra. Sin el prefijo, la
 * segunda que sincronizara se quedaría sin QR por un choque absurdo.
 *
 * Es determinista a propósito: un cartel ya impreso tiene que seguir valiendo
 * después de volver a sincronizar.
 */
export function tokenDeInmueble(businessId: string, referencia: string): string {
  const negocio = businessId.replace(/-/g, "").slice(0, 8);
  const ref = referencia
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 18);
  // Si la referencia se queda en nada (venía solo con símbolos), se usa su
  // posición en la base más adelante; aquí al menos no se genera un token
  // inválido que la base rechazaría.
  return `p${negocio}-${ref || "sinref"}`;
}

export function urlDeQr(
  base: string,
  slug: string,
  token: string,
  destino?: string,
  /** Solo para destino "property": el trozo de URL de ese inmueble. */
  inmueble?: string,
): string {
  const raiz = base.replace(/\/+$/, "");
  const rutas: Record<string, string> = {
    menu: "/carta",
    daily_menu: "/menu-del-dia",
    reservation: "/reservar",
    group: "/grupos",
    review: "/opinion",
    listings: "/inmuebles",
    valuation: "/valoracion",
  };
  // Un QR por inmueble: es lo que permite saber QUÉ piso se mira de noche con
  // la oficina cerrada, y decirle luego al propietario cuántas veces.
  const ruta = destino === "property" && inmueble
    ? `/inmueble/${encodeURIComponent(inmueble)}`
    : (destino ? (rutas[destino] ?? "") : "");
  return `${raiz}/b/${slug}${ruta}?qr=${encodeURIComponent(token)}`;
}
