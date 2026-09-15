import type { Tema } from "@/types/dominio";

const TEMA_POR_DEFECTO: Required<Pick<Tema, "marca" | "acento" | "fondo" | "texto">> = {
  marca: "#0E2A3F",
  acento: "#C2A06A",
  fondo: "#F6F7F9",
  texto: "#101828",
};

function normalizarHex(color: string | undefined): string | null {
  if (!color) return null;
  const limpio = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(limpio)) return limpio.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(limpio)) {
    const [r, g, b] = limpio.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

function canalLineal(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa según WCAG 2.1. */
export function luminancia(hex: string): number {
  const h = normalizarHex(hex) ?? "#000000";
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

/** Relación de contraste entre dos colores (1 = idénticos, 21 = negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Texto blanco o negro sobre un fondo: el que más contraste dé.
 *
 * Ojo con lo que esto garantiza y lo que no. Con solo dos opciones, hay colores
 * intermedios (un rojo puro, un verde medio) donde NI blanco ni negro llegan a
 * 4.5:1. Esta función elige siempre la mejor de las dos, pero no puede inventar
 * contraste que el color no tiene: para avisar de esos casos está
 * `contrasteInsuficiente()`, que es lo que usa el panel cuando alguien elige su
 * color de marca.
 */
export function textoSobre(fondo: string): "#FFFFFF" | "#101828" {
  return contraste(fondo, "#FFFFFF") >= contraste(fondo, "#101828") ? "#FFFFFF" : "#101828";
}

/** ¿Este par cumple el mínimo AA para texto normal? */
export function cumpleAA(texto: string, fondo: string): boolean {
  return contraste(texto, fondo) >= 4.5;
}

/**
 * ¿Este color de fondo es problemático se ponga encima lo que se ponga? Devuelve
 * el mejor contraste alcanzable, para poder decírselo al negocio con un número
 * en vez de con un «podría verse mal».
 */
export function contrasteInsuficiente(fondo: string): { problematico: boolean; mejorRatio: number } {
  const mejor = Math.max(contraste(fondo, "#FFFFFF"), contraste(fondo, "#101828"));
  return { problematico: mejor < 4.5, mejorRatio: Math.round(mejor * 10) / 10 };
}

/**
 * Convierte el tema guardado en `businesses.theme` en variables CSS que se
 * inyectan en línea sobre la landing. Cambiar los colores de un cliente es
 * editar una fila, no volver a desplegar.
 */
export function variablesTema(tema: Tema | null | undefined): React.CSSProperties {
  const marca = normalizarHex(tema?.marca) ?? TEMA_POR_DEFECTO.marca;
  const acento = normalizarHex(tema?.acento) ?? TEMA_POR_DEFECTO.acento;
  const fondo = normalizarHex(tema?.fondo) ?? TEMA_POR_DEFECTO.fondo;
  const texto = normalizarHex(tema?.texto) ?? TEMA_POR_DEFECTO.texto;

  return {
    ["--marca" as string]: marca,
    ["--marca-suave" as string]: mezclar(marca, "#FFFFFF", 0.18),
    ["--marca-contraste" as string]: textoSobre(marca),
    ["--acento" as string]: acento,
    ["--acento-contraste" as string]: textoSobre(acento),
    ["--fondo" as string]: fondo,
    ["--texto" as string]: texto,
  } as React.CSSProperties;
}

/** Mezcla dos colores (proporción 0-1 del segundo). */
export function mezclar(a: string, b: string, proporcion: number): string {
  const ha = normalizarHex(a) ?? "#000000";
  const hb = normalizarHex(b) ?? "#FFFFFF";
  const canal = (i: number) => {
    const va = parseInt(ha.slice(1 + i * 2, 3 + i * 2), 16);
    const vb = parseInt(hb.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(va + (vb - va) * proporcion)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${canal(0)}${canal(1)}${canal(2)}`.toUpperCase();
}

export { normalizarHex, TEMA_POR_DEFECTO };
