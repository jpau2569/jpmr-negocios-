// ============================================================================
//  CSV para Excel en español — lógica pura
// ----------------------------------------------------------------------------
//  Excel con configuración española usa «;» como separador y necesita el BOM
//  de UTF-8 para leer bien las tildes y la ñ. Saltos de línea CRLF.
//  Además se neutralizan las fórmulas: una celda que empieza por = + - @ se
//  ejecutaría al abrir el archivo (inyección CSV), así que se le antepone '.
// ============================================================================

export const BOM = "﻿";
export const SEPARADOR = ";";

export function celda(valor) {
  if (valor === null || valor === undefined) return "";
  let t = String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  if (/[;"\r\n]/.test(t)) t = `"${t.replace(/"/g, '""')}"`;
  return t;
}

/** cabecera: ['Nombre', …]; filas: [['Ana', …], …]. Devuelve el texto con BOM. */
export function aCsv(cabecera, filas) {
  const lineas = [cabecera, ...filas].map((fila) => fila.map(celda).join(SEPARADOR));
  return BOM + lineas.join("\r\n") + "\r\n";
}
