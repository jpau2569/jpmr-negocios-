import { z } from "zod";
import {
  baseFormularioPublico, emailOpcional, nombrePersona, telefonoEs, textoLibre,
} from "./comunes";

/**
 * Un esquema por formulario público. Cada uno declara qué tipo de lead genera:
 * así el CRM sabe de dónde viene cada contacto sin que la ruta tenga que
 * adivinarlo.
 */

export const TIPOS_INMUEBLE = [
  "piso", "casa", "chalet", "atico", "duplex", "estudio",
  "local", "oficina", "nave", "garaje", "trastero", "parcela", "edificio",
] as const;

export const esquemaContacto = baseFormularioPublico.extend({
  tipo: z.enum([
    "seller", "buyer", "tenant", "landlord", "investor",
    "general_consultation", "community_administration", "tax_labor_legal_consultation",
  ]),
  nombre: nombrePersona,
  telefono: telefonoEs,
  email: emailOpcional,
  mensaje: textoLibre(1000),
  horarioPreferido: textoLibre(60),
  propertyId: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
});

export const esquemaVisita = baseFormularioPublico.extend({
  propertyId: z.string().uuid().optional(),
  modo: z.enum(["presencial", "videollamada", "llamada"]).default("presencial"),
  nombre: nombrePersona,
  telefono: telefonoEs,
  email: emailOpcional,
  fechaPreferida: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  franja: textoLibre(60),
  mensaje: textoLibre(600),
});

export const esquemaValoracion = baseFormularioPublico.extend({
  tipoInmueble: z.enum(TIPOS_INMUEBLE),
  objetivo: z.enum(["venta", "alquiler", "herencia", "orientacion", "otra"]),
  municipio: z.string().trim().min(2, "Dinos el municipio").max(80),
  zona: textoLibre(80),
  metros: z.coerce.number().int().min(10, "Mínimo 10 m²").max(10000).optional(),
  habitaciones: z.coerce.number().int().min(0).max(20).optional(),
  banos: z.coerce.number().int().min(0).max(20).optional(),
  estado: z.enum(["a_reformar", "buen_estado", "reformado", "obra_nueva", "no_lo_se"]).optional(),
  ascensor: z.boolean().optional(),
  terraza: z.boolean().optional(),
  garaje: z.boolean().optional(),
  reforma: z.boolean().optional(),
  nombre: nombrePersona,
  telefono: telefonoEs,
  email: emailOpcional,
  horarioPreferido: textoLibre(60),
  mensaje: textoLibre(600),
});

export const esquemaBusqueda = baseFormularioPublico.extend({
  operacion: z.enum(["venta", "alquiler"]),
  tiposInmueble: z.array(z.enum(TIPOS_INMUEBLE)).max(6).default([]),
  zonas: z.string().trim().max(200).optional(),
  presupuestoMax: z.coerce.number().int().min(0).max(100000000).optional(),
  habitacionesMin: z.coerce.number().int().min(0).max(20).optional(),
  imprescindibles: z.array(z.string().max(40)).max(12).default([]),
  plazo: textoLibre(60),
  nombre: nombrePersona,
  telefono: telefonoEs,
  email: emailOpcional,
  mensaje: textoLibre(600),
});

/**
 * La opinión es el único formulario donde el consentimiento no siempre es
 * obligatorio: dejar una valoración anónima no debería exigir ceder datos
 * personales. Solo si la persona pide que la contacten hacen falta datos de
 * contacto y consentimiento, y entonces sí se exigen.
 */
export const esquemaOpinion = z
  .object({
    businessSlug: z.string().min(1).max(80),
    companyWebsite: z.string().max(80).optional(),
    puntuacion: z.coerce.number().int().min(1).max(5),
    comentario: textoLibre(1200),
    quiereContacto: z.boolean().default(false),
    nombre: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
    telefono: z.string().trim().max(20).optional().or(z.literal("").transform(() => undefined)),
    email: emailOpcional,
    propertyId: z.string().uuid().optional(),
    contexto: baseFormularioPublico.shape.contexto,
    consent: z.boolean().optional(),
  })
  .refine((v) => !v.quiereContacto || (v.consent === true && Boolean(v.telefono || v.email)), {
    message: "Para que te contactemos necesitamos un teléfono o correo y tu consentimiento",
    path: ["consent"],
  });

export const esquemaEvento = z.object({
  businessSlug: z.string().min(1).max(80),
  tipo: z.string().min(3).max(40),
  sessionId: z.string().max(64).optional(),
  propertyId: z.string().uuid().optional(),
  qrCode: z.string().max(64).optional(),
  path: z.string().max(200).optional(),
  metadata: z.record(z.union([z.string().max(80), z.number(), z.boolean()])).optional(),
});

export const esquemaPreguntaAsistente = z.object({
  businessSlug: z.string().min(1).max(80),
  pregunta: z.string().trim().min(3, "Escribe tu pregunta").max(400),
  sessionId: z.string().max(64).optional(),
});

/**
 * Dos tipos por formulario, y no es redundancia:
 *
 *   · `Entrada…` es lo que hay en los campos mientras se rellena (con
 *     `default()` sin aplicar y el consentimiento todavía en false).
 *   · `Datos…` es lo que sale ya validado y es lo que recibe el servidor.
 *
 * React Hook Form necesita el primero y el `handleSubmit` entrega el segundo.
 */
export type EntradaContacto = z.input<typeof esquemaContacto>;
export type EntradaVisita = z.input<typeof esquemaVisita>;
export type EntradaValoracion = z.input<typeof esquemaValoracion>;
export type EntradaBusqueda = z.input<typeof esquemaBusqueda>;
export type EntradaOpinion = z.input<typeof esquemaOpinion>;

export type DatosContacto = z.output<typeof esquemaContacto>;
export type DatosVisita = z.output<typeof esquemaVisita>;
export type DatosValoracion = z.output<typeof esquemaValoracion>;
export type DatosBusqueda = z.output<typeof esquemaBusqueda>;
export type DatosOpinion = z.output<typeof esquemaOpinion>;
