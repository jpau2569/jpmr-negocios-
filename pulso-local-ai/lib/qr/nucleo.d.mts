// ============================================================================
//  Tipos de nucleo.mjs
// ----------------------------------------------------------------------------
//  nucleo.mjs es COPIA LITERAL de fotos-faciles/nucleo/qr.mjs, que ya está
//  verificado módulo a módulo contra la librería `qrcode`. No se reescribe a
//  TypeScript a propósito: reescribir un codificador QR correcto es la mejor
//  manera de introducir un fallo que solo se ve cuando un cliente escanea un
//  cartel impreso. Un test comprueba que sigue siendo idéntico al original.
// ============================================================================

export type NivelCorreccion = "L" | "M" | "Q" | "H";

export interface MatrizQr {
  /** Módulos por lado, sin contar el margen. */
  tamano: number;
  /** modulos[fila][columna] — true = módulo oscuro. */
  modulos: boolean[][];
}

export function matriz(
  texto: string,
  opciones?: { nivel?: NivelCorreccion; forzarMascara?: number | null },
): MatrizQr;

export function svg(
  texto: string,
  opciones?: { nivel?: NivelCorreccion; margen?: number; claro?: string; oscuro?: string },
): string;

export function ascii(
  texto: string,
  opciones?: { nivel?: NivelCorreccion; margen?: number },
): string;
