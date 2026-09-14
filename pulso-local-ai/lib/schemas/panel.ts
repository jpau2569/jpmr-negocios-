// ============================================================================
//  Esquemas del panel
// ----------------------------------------------------------------------------
//  Lo que el negocio escribe desde el panel. Se valida igual de estricto que lo
//  que llega del público: un dueño con prisa a las once de la mañana se
//  equivoca tanto como un robot, solo que sin mala intención.
// ============================================================================

import { z } from "zod";

/** Precio en euros tal como lo teclea una persona: "12", "12,50", "12.50". */
export const precioEuros = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === "") return null;
    const texto = String(v).trim().replace(",", ".");
    const n = Number(texto);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  });

const CURSOS = ["primero", "segundo", "postre", "bebida"] as const;

export const esquemaMenuDia = z.object({
  slug: z.string().min(1),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige un día"),
  price_cents: precioEuros,
  includes_drink: z.coerce.boolean().default(false),
  notes: z.string().trim().max(500).optional(),
  status: z.enum(["draft", "published", "sold_out"]).default("draft"),
  platos: z
    .array(
      z.object({
        course: z.enum(CURSOS),
        name: z.string().trim().min(1).max(140),
        description: z.string().trim().max(200).optional(),
      }),
    )
    .max(40, "Son demasiados platos para un menú del día"),
});
export type DatosMenuDia = z.infer<typeof esquemaMenuDia>;

export const esquemaEstadoReserva = z.object({
  slug: z.string().min(1),
  id: z.string().uuid(),
  tipo: z.enum(["reserva", "grupo"]),
  status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
  staff_notes: z.string().trim().max(500).optional(),
});
export type DatosEstadoReserva = z.infer<typeof esquemaEstadoReserva>;

export const esquemaPlato = z.object({
  slug: z.string().min(1),
  id: z.string().uuid(),
  price_cents: precioEuros.optional(),
  status: z.enum(["draft", "published", "sold_out"]).optional(),
  /** false = el negocio ya lo ha confirmado y deja de salir marcado. */
  is_demo: z.boolean().optional(),
  name: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(400).optional(),
});
export type DatosPlato = z.infer<typeof esquemaPlato>;

export interface MenuInterpretado {
  platos: DatosMenuDia["platos"];
  /** En céntimos, si aparecía un precio en el texto. */
  precioCents: number | null;
  /** true si el texto dice que la bebida va incluida. */
  bebidaIncluida: boolean;
}

/**
 * Texto pegado de una pizarra o un WhatsApp, tal cual.
 * El hostelero no va a rellenar quince campos: pega el menú como ya lo tiene
 * escrito y esto lo reparte en primeros, segundos y postres.
 *
 * También saca el precio y si la bebida va incluida, porque un menú pegado
 * casi siempre empieza por algo como "MENÚ DEL DÍA 14€ bebida incluida". Esa
 * línea no es un plato: es la cabecera, y si no se detecta acaba apareciendo
 * como primer primero y el dueño tiene que borrarla a mano.
 */
export function interpretarMenuPegado(texto: string): MenuInterpretado {
  const platos: DatosMenuDia["platos"] = [];
  let precioCents: number | null = null;
  // Sin \b alrededor de "inclu": "incluida" e "incluye" son palabras distintas
  // y \binclu\b no casa con ninguna de las dos.
  const bebidaIncluida =
    /(bebida|vino|agua|caf[eé])[^.\n]{0,25}inclu|inclu\w*[^.\n]{0,25}(bebida|vino|agua)/i.test(texto);
  let cursoActual: (typeof CURSOS)[number] = "primero";

  // Anclados con $ a propósito: así "Primeros:" cambia de sección pero
  // "Primero de pasta" es un plato. Y con el plural dentro del paréntesis,
  // porque en una pizarra se escribe "PRIMEROS", no "PRIMERO".
  const ENCABEZADOS: [RegExp, (typeof CURSOS)[number]][] = [
    [/^(primer[oa]s?|1[.ºo]?\s*plato|entrantes?|para\s+empezar)\s*:?\s*$/i, "primero"],
    [/^(segund[oa]s?|2[.ºo]?\s*plato|principales?|plato\s+principal)\s*:?\s*$/i, "segundo"],
    [/^(postres?|dulces?)\s*:?\s*$/i, "postre"],
    [/^(bebidas?|para\s+beber)\s*:?\s*$/i, "bebida"],
  ];

  for (const linea of texto.split(/\r?\n/)) {
    // Se quitan las viñetas y la numeración con que se escriben estas listas:
    // "- Fabada", "1. Merluza", "• Arroz con leche".
    const limpia = linea.trim().replace(/^[-–—*·•]+\s*|^\d+[.)]\s*/, "").trim();
    if (!limpia) continue;

    const encabezado = ENCABEZADOS.find(([patron]) => patron.test(limpia));
    if (encabezado) {
      cursoActual = encabezado[1];
      continue;
    }

    // Cabecera del menú: "MENÚ DEL DÍA 14€", "Menú de hoy - 12,50 euros".
    // Se le saca el precio y no se cuenta como plato.
    // Ojo con \b tras "menú": en JavaScript \b se define sobre [A-Za-z0-9_], y
    // "ú" queda fuera, así que /^men[uú]\b/ NO casa con "Menú del día" aunque
    // sí lo haga con "Menu del día". Se comprueba que no siga una letra.
    if (/^men[uú](?![a-záéíóúñ])/i.test(limpia)) {
      const conPrecio = /(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)/i.exec(limpia);
      if (conPrecio?.[1]) {
        const n = Number(conPrecio[1].replace(",", "."));
        if (Number.isFinite(n) && n > 0) precioCents = Math.round(n * 100);
      }
      continue;
    }

    platos.push({ course: cursoActual, name: limpia.slice(0, 140) });
  }

  return { platos: platos.slice(0, 40), precioCents, bebidaIncluida };
}
