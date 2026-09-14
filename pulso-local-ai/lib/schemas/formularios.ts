// ============================================================================
//  Esquemas Zod — compartidos por el navegador y el servidor
// ----------------------------------------------------------------------------
//  El mismo esquema valida en los dos sitios, pero no por el mismo motivo:
//  en el cliente es comodidad (avisar antes de enviar) y en el servidor es
//  seguridad. Nada que venga de fuera entra en la base sin pasar por aquí.
//
//  Los mensajes están en español de España y escritos para que los lea alguien
//  sentado en una mesa, no un programador.
// ============================================================================

import { z } from "zod";

/* --- Piezas reutilizables --------------------------------------------------- */

const nombre = z
  .string()
  .trim()
  .min(2, "Escribe tu nombre")
  .max(80, "Ese nombre es demasiado largo");

// Se acepta cómo la gente escribe de verdad un teléfono: con espacios, guiones
// y prefijo. Se limpia después, no se le exige al usuario que acierte el formato.
const telefono = z
  .string()
  .trim()
  .min(9, "El teléfono parece corto")
  .max(20, "El teléfono parece largo")
  .regex(/^[+()\d\s.-]+$/, "El teléfono solo puede llevar números")
  .refine((v) => v.replace(/\D/g, "").length >= 9, "Faltan dígitos en el teléfono");

const email = z.string().trim().email("Ese correo no parece válido").max(120);

const comentario = z.string().trim().max(1000, "Se ha quedado muy largo").optional();

// Campo trampa: es invisible en el formulario, así que una persona nunca lo
// rellena. Si viene con algo, es un robot y la petición se descarta.
const honeypot = z.string().max(0, "no").optional().or(z.literal(""));

const utm = z
  .object({
    utm_source: z.string().max(60).optional(),
    utm_medium: z.string().max(60).optional(),
    utm_campaign: z.string().max(60).optional(),
  })
  .partial()
  .optional();

const qrToken = z.string().regex(/^[a-zA-Z0-9_-]{4,32}$/).optional();

/** El consentimiento no es una casilla más: sin él, la fila no se crea. */
const consentimiento = z.literal(true, {
  errorMap: () => ({ message: "Necesitamos que aceptes para poder guardar tus datos" }),
});

/* --- Reserva ---------------------------------------------------------------- */

export const esquemaReserva = z.object({
  slug: z.string().min(1),
  name: nombre,
  phone: telefono,
  email: email.optional().or(z.literal("")),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige un día"),
  service_time: z.string().regex(/^\d{2}:\d{2}$/, "Elige una hora"),
  party_size: z.coerce
    .number()
    .int()
    .min(1, "¿Cuántos sois?")
    .max(200, "Para tantos, mejor llámanos y lo organizamos"),
  occasion: z.enum(["lunch", "dinner", "birthday", "group", "event", "other"]).default("other"),
  comments: comentario,
  // Aviso voluntario para preparar el servicio. NO es un historial médico y se
  // guarda como texto libre corto, no como categoría de salud.
  allergies_note: z.string().trim().max(300).optional(),
  consent: consentimiento,
  website: honeypot,
  qr: qrToken,
  utm,
});
export type DatosReserva = z.infer<typeof esquemaReserva>;

/* --- Grupos y celebraciones -------------------------------------------------- */

export const esquemaGrupo = z.object({
  slug: z.string().min(1),
  name: nombre,
  phone: telefono,
  email: email.optional().or(z.literal("")),
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  party_size: z.coerce.number().int().min(1).max(500).optional(),
  celebration: z.string().trim().max(80).optional(),
  budget_hint: z.string().trim().max(80).optional(),
  needs_menu: z.coerce.boolean().default(false),
  comments: comentario,
  consent: consentimiento,
  website: honeypot,
  qr: qrToken,
  utm,
});
export type DatosGrupo = z.infer<typeof esquemaGrupo>;

/* --- Feedback ----------------------------------------------------------------
   El comentario es opcional con CUALQUIER puntuación, y los datos de contacto
   solo se piden si la persona quiere que le respondan. */

export const esquemaFeedback = z.object({
  slug: z.string().min(1),
  rating: z.coerce.number().int().min(1, "Elige de 1 a 5").max(5),
  comment: comentario,
  wants_contact: z.coerce.boolean().default(false),
  contact_name: z.string().trim().max(80).optional(),
  contact_phone: z.string().trim().max(20).optional(),
  website: honeypot,
  qr: qrToken,
});
export type DatosFeedback = z.infer<typeof esquemaFeedback>;

/* --- Fidelización ------------------------------------------------------------ */

export const esquemaLead = z
  .object({
    slug: z.string().min(1),
    name: z.string().trim().max(80).optional(),
    phone: telefono.optional().or(z.literal("")),
    email: email.optional().or(z.literal("")),
    channel: z.enum(["whatsapp", "email", "sms"]).default("whatsapp"),
    interests: z
      .array(z.enum(["daily_menu", "events", "special_menus", "promotions"]))
      .default([]),
    consent: consentimiento,
    website: honeypot,
    qr: qrToken,
    utm,
  })
  // Pedir el canal preferido y luego no tener por dónde escribir sería absurdo.
  .refine((d) => Boolean(d.phone) || Boolean(d.email), {
    message: "Déjanos un teléfono o un correo, lo que prefieras",
    path: ["phone"],
  });
export type DatosLead = z.infer<typeof esquemaLead>;

/* --- Analítica ---------------------------------------------------------------
   Sin un solo dato personal: ni IP en claro ni identificador de persona. Por
   eso esta app no necesita banner de cookies. */

export const esquemaEvento = z.object({
  slug: z.string().min(1),
  event_type: z.enum([
    "qr_landing_view", "menu_view", "daily_menu_view", "special_menu_view",
    "category_view", "dish_view", "whatsapp_click", "call_click",
    "directions_click", "reservation_start", "reservation_submit",
    "group_request_start", "group_request_submit", "feedback_start",
    "feedback_submit", "google_review_click", "promotion_view", "lead_submit",
    "ai_chat_open", "ai_question_submit", "qr_download", "qr_print_preview",
  ]),
  subject_id: z.string().uuid().optional(),
  qr: qrToken,
  path: z.string().max(200).optional(),
  session: z.string().max(64).optional(),
});
export type DatosEvento = z.infer<typeof esquemaEvento>;

/* --- Asistente ---------------------------------------------------------------- */

export const esquemaPregunta = z.object({
  slug: z.string().min(1),
  question: z.string().trim().min(2, "Escribe tu pregunta").max(300),
});
export type DatosPregunta = z.infer<typeof esquemaPregunta>;

/* --- Utilidades -------------------------------------------------------------- */

/** Teléfono tal y como se marca: solo dígitos y un + delante si lo traía. */
export function telefonoLimpio(valor: string): string {
  const texto = valor.replace(/[^\d+]/g, "");
  return texto.startsWith("+") ? `+${texto.slice(1).replace(/\+/g, "")}` : texto;
}

/** WhatsApp: wa.me no admite el "+", solo dígitos con prefijo de país. */
export function whatsappLimpio(valor: string | null | undefined): string {
  return String(valor ?? "").replace(/\D/g, "");
}
