import { z } from "zod";

/**
 * Piezas de validación compartidas. Los mismos esquemas se usan en el navegador
 * (para avisar mientras se escribe) y en el servidor (para decidir de verdad).
 * El cliente valida por cortesía; el servidor valida porque es lo único fiable.
 */

/** Nueve dígitos españoles, con o sin espacios, guiones o prefijo +34. */
export const telefonoEs = z
  .string()
  .trim()
  .min(9, "Escribe un teléfono de contacto")
  .max(20, "Ese teléfono es demasiado largo")
  .refine((v) => {
    const digitos = v.replace(/\D/g, "");
    return digitos.length >= 9 && digitos.length <= 15;
  }, "Ese teléfono no parece correcto");

export const nombrePersona = z
  .string()
  .trim()
  .min(2, "Dinos cómo te llamas")
  .max(80, "El nombre es demasiado largo");

export const emailOpcional = z
  .string()
  .trim()
  .email("Ese correo no parece correcto")
  .max(120)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const textoLibre = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const consentimiento = z.literal(true, {
  errorMap: () => ({ message: "Necesitamos tu consentimiento para poder contactarte" }),
});

/**
 * Honeypot: un campo que ninguna persona ve ni rellena. Si viene con algo
 * dentro, es un bot. No se responde con error: se devuelve «ok» para no darle
 * pistas, pero no se guarda nada.
 */
export const honeypot = z.string().max(80).optional();

export const contexto = z.object({
  sessionId: z.string().max(64).optional(),
  qrCode: z.string().max(64).optional(),
  path: z.string().max(200).optional(),
  utmSource: z.string().max(60).optional(),
  utmMedium: z.string().max(60).optional(),
  utmCampaign: z.string().max(60).optional(),
});

export const baseFormularioPublico = z.object({
  businessSlug: z.string().min(1).max(80),
  consent: consentimiento,
  companyWebsite: honeypot,
  contexto: contexto.optional(),
});

// Caracteres de control (incluido el DEL). Se construye desde texto escapado
// para que el fichero no contenga bytes invisibles.
const CARACTERES_CONTROL = new RegExp("[\\u0000-\\u001F\\u007F]", "g");
const ETIQUETAS_HTML = /<[^>]*>/g;

/** Quita etiquetas, caracteres de control y espacios repetidos. */
export function sanear(texto: string | undefined | null): string | null {
  if (!texto) return null;
  const limpio = texto
    .replace(ETIQUETAS_HTML, " ")
    .replace(CARACTERES_CONTROL, " ")
    .replace(/\s+/g, " ")
    .trim();
  return limpio.length ? limpio : null;
}

/** ¿El honeypot delata a un bot? */
export function esBot(valor: unknown): boolean {
  return typeof valor === "string" && valor.trim().length > 0;
}

export type Contexto = z.infer<typeof contexto>;
