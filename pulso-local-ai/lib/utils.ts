// ============================================================================
//  Utilidades transversales
// ============================================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...clases: ClassValue[]): string {
  return twMerge(clsx(clases));
}

/* --- Dinero ------------------------------------------------------------------
   Todo se guarda en céntimos (enteros). Los decimales en coma flotante y el
   dinero no se llevan bien, y aquí hay precios de carta. */

export function euros(centimos: number | null | undefined, opciones: { desde?: boolean } = {}): string {
  if (centimos === null || centimos === undefined || !Number.isFinite(centimos)) return "Consultar";
  const valor = centimos / 100;
  const texto = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: valor % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(valor);
  return opciones.desde ? `Desde ${texto}` : texto;
}

/* --- Fechas ------------------------------------------------------------------ */

export function hoyISO(fecha = new Date()): string {
  // Local, no UTC: el menú "de hoy" es el de hoy aquí, no en Greenwich.
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sumaDias(iso: string, dias: number): string {
  const f = new Date(`${iso}T00:00:00`);
  f.setDate(f.getDate() + dias);
  return hoyISO(f);
}

export function fechaLarga(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      weekday: "long", day: "numeric", month: "long",
    }).format(new Date(`${iso}T00:00:00`));
  } catch {
    return iso;
  }
}

/* --- Contraste ---------------------------------------------------------------
   El texto sobre el color de acento se elige calculando, no a ojo. Hay marcas
   con acento amarillo donde el texto blanco encima es ilegible, y eso es un
   fallo de accesibilidad AA, no una cuestión de gusto. */

function luminancia(hex: string): number {
  const limpio = hex.replace("#", "");
  const completo = limpio.length === 3
    ? limpio.split("").map((c) => c + c).join("")
    : limpio;
  const canal = (i: number): number => {
    const v = parseInt(completo.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Blanco o grafito sobre un fondo, el que más contraste dé. */
export function textoSobre(fondo: string, claro = "#f3efe6", oscuro = "#17181b"): string {
  return contraste(fondo, claro) >= contraste(fondo, oscuro) ? claro : oscuro;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
export function colorValido(valor: unknown, respaldo: string): string {
  return typeof valor === "string" && HEX.test(valor.trim()) ? valor.trim() : respaldo;
}

/* --- Texto -------------------------------------------------------------------- */

export function recortar(texto: string, maximo: number): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1).trimEnd()}…` : texto;
}

/** Huella de sesión efímera para no contar 40 veces al mismo móvil.
 *  No identifica a nadie: se genera en el navegador y muere con la pestaña. */
export function huellaSesion(): string {
  if (typeof window === "undefined") return "";
  const CLAVE = "plai:sesion";
  try {
    const guardada = sessionStorage.getItem(CLAVE);
    if (guardada) return guardada;
    const nueva = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(CLAVE, nueva);
    return nueva;
  } catch {
    // Navegación privada o almacenamiento bloqueado: se mide sin agrupar.
    return "";
  }
}
