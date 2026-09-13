import { matriz, svg as svgQr } from "./qr.mjs";
import { contraste } from "../tema";

/**
 * Capa de aplicación sobre el generador de QR.
 *
 * Las importaciones de este módulo son relativas y no usan el alias `@/` a
 * propósito: así el banco de pruebas puede compilarlo suelto y comprobar que el
 * QR que se imprime en un cartel es exactamente el que debe ser.
 *
 * Aquí vive lo que el panel necesita y el algoritmo no sabe: validar que los
 * colores elegidos se puedan leer con una cámara, dejar hueco al logo y componer
 * los carteles imprimibles.
 */

export interface OpcionesQr {
  nivel?: "L" | "M" | "Q" | "H";
  margen?: number;
  colorOscuro?: string;
  colorClaro?: string;
  logoUrl?: string | null;
}

/**
 * Un lector de QR necesita contraste. Por debajo de 3:1 la cámara del móvil
 * empieza a fallar con luz de escaparate; a partir de 7:1 va bien siempre.
 */
export function validarContrasteQr(oscuro: string, claro: string): { valido: boolean; ratio: number; aviso?: string } {
  const ratio = contraste(oscuro, claro);
  if (ratio < 3) {
    return { valido: false, ratio, aviso: "Estos colores no se leen bien. Usa un color oscuro sobre fondo claro." };
  }
  if (ratio < 7) {
    return { valido: true, ratio, aviso: "Se lee, pero con poca luz puede costar. Lo ideal es más contraste." };
  }
  return { valido: true, ratio };
}

/**
 * SVG del QR. Con logo se sube el nivel de corrección a H: el logo tapa módulos
 * y sin ese margen de error el código dejaría de leerse.
 */
export function qrSvg(texto: string, opciones: OpcionesQr = {}): string {
  const nivel = opciones.logoUrl ? "H" : (opciones.nivel ?? "Q");
  const base = svgQr(texto, {
    nivel,
    margen: opciones.margen ?? 2,
    claro: opciones.colorClaro ?? "#FFFFFF",
    oscuro: opciones.colorOscuro ?? "#0E2A3F",
  }) as string;

  if (!opciones.logoUrl) return base;

  const { tamano } = matriz(texto, { nivel }) as { tamano: number };
  const total = tamano + (opciones.margen ?? 2) * 2;
  const ladoLogo = Math.round(total * 0.22);
  const inicio = (total - ladoLogo) / 2;

  const recuadro =
    `<rect x="${inicio - 0.6}" y="${inicio - 0.6}" width="${ladoLogo + 1.2}" height="${ladoLogo + 1.2}" rx="1.2" fill="${opciones.colorClaro ?? "#FFFFFF"}"/>` +
    `<image x="${inicio}" y="${inicio}" width="${ladoLogo}" height="${ladoLogo}" href="${escaparXml(opciones.logoUrl)}" preserveAspectRatio="xMidYMid meet"/>`;

  return base.replace("</svg>", `${recuadro}</svg>`);
}

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type FormatoCartel = "A4" | "A5" | "tarjeta" | "escaparate";

const MEDIDAS: Record<FormatoCartel, { ancho: number; alto: number; titulo: number; qr: number }> = {
  A4: { ancho: 210, alto: 297, titulo: 16, qr: 110 },
  A5: { ancho: 148, alto: 210, titulo: 12, qr: 80 },
  tarjeta: { ancho: 85, alto: 55, titulo: 5.5, qr: 28 },
  escaparate: { ancho: 210, alto: 210, titulo: 15, qr: 120 },
};

export interface DatosCartel {
  titulo: string;
  subtitulo?: string;
  pie?: string;
  negocio: string;
  url: string;
  formato: FormatoCartel;
  colorMarca?: string;
  colorAcento?: string;
  logoUrl?: string | null;
}

/**
 * Cartel imprimible en SVG, en milímetros reales. Se puede mandar a imprimir o
 * abrir el diálogo del navegador: el tamaño sale exacto porque el `viewBox` está
 * en milímetros y no en píxeles.
 */
export function cartelSvg(datos: DatosCartel): string {
  const m = MEDIDAS[datos.formato];
  const marca = datos.colorMarca ?? "#0E2A3F";
  const acento = datos.colorAcento ?? "#C2A06A";
  const qr = qrSvg(datos.url, { colorOscuro: marca, colorClaro: "#FFFFFF", nivel: "Q" });
  const interior = qr.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const ladoModulos = Number(qr.match(/viewBox="0 0 (\d+)/)?.[1] ?? 25);
  const escala = m.qr / ladoModulos;
  const xQr = (m.ancho - m.qr) / 2;
  const yQr = m.alto * (datos.formato === "tarjeta" ? 0.3 : 0.34);

  const subtitulo = datos.subtitulo
    ? `<text x="${m.ancho / 2}" y="${m.alto * 0.235}" text-anchor="middle" font-size="${m.titulo * 0.42}" fill="#4D5866">${escaparXml(datos.subtitulo)}</text>`
    : "";

  const pie = datos.pie
    ? `<text x="${m.ancho / 2}" y="${m.alto - m.alto * 0.06}" text-anchor="middle" font-size="${m.titulo * 0.38}" fill="#4D5866">${escaparXml(datos.pie)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${m.ancho}mm" height="${m.alto}mm" viewBox="0 0 ${m.ancho} ${m.alto}" role="img" aria-label="Cartel con código QR">
  <rect width="${m.ancho}" height="${m.alto}" fill="#FFFFFF"/>
  <rect width="${m.ancho}" height="${m.alto * 0.035}" fill="${acento}"/>
  <text x="${m.ancho / 2}" y="${m.alto * 0.16}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${m.titulo}" font-weight="700" fill="${marca}">${escaparXml(datos.titulo)}</text>
  ${subtitulo}
  <g transform="translate(${xQr} ${yQr}) scale(${escala})" font-family="system-ui, sans-serif">${interior}</g>
  <text x="${m.ancho / 2}" y="${yQr + m.qr + m.titulo * 0.9}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${m.titulo * 0.5}" font-weight="600" fill="${marca}">${escaparXml(datos.negocio)}</text>
  ${pie}
</svg>`;
}

export { matriz };
