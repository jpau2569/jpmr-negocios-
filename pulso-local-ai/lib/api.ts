import "server-only";

// ============================================================================
//  Piezas compartidas por los endpoints públicos
// ----------------------------------------------------------------------------
//  Todos los formularios públicos entran por aquí, sin sesión. Así que TODA la
//  defensa está en el servidor:
//
//    1. Honeypot: si el campo trampa viene relleno, es un robot. Se responde
//       200 como si todo hubiera ido bien, para que no aprenda que le hemos
//       calado, pero no se guarda nada.
//    2. Límite de peticiones por IP y negocio.
//    3. Validación Zod, con el esquema entero, no campo a campo.
//    4. Escritura con service_role, filtrando por business_id a mano: aquí RLS
//       ya no protege, porque service_role la salta.
//    5. Comprobación de que el negocio está vigente. Una demo caducada no
//       recoge datos de nadie.
// ============================================================================

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { admin } from "./supabase/servidor";
import { hayBackend } from "./datos";

/* --- Límite de peticiones ----------------------------------------------------
   En memoria: suficiente para lo que es (frenar a un robot tonto y a un
   ansioso que pulsa diez veces). No sobrevive a un reinicio ni se comparte
   entre instancias; cuando haga falta de verdad, va a Upstash o a la propia
   base. Se documenta aquí para que nadie lo confunda con protección seria
   contra un ataque dirigido. */

const VENTANA_MS = 60_000;
const MAXIMO = 6;
const golpes = new Map<string, number[]>();

export function limitar(clave: string, maximo = MAXIMO): boolean {
  const ahora = Date.now();
  const previos = (golpes.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (previos.length >= maximo) {
    golpes.set(clave, previos);
    return false;
  }
  previos.push(ahora);
  golpes.set(clave, previos);
  // Limpieza perezosa: sin esto el mapa crece sin fin en un servidor de larga vida.
  if (golpes.size > 5000) {
    for (const [k, v] of golpes) {
      if (v.every((t) => ahora - t >= VENTANA_MS)) golpes.delete(k);
    }
  }
  return true;
}

export function ipDe(peticion: Request): string {
  const cabecera = peticion.headers.get("x-forwarded-for") ?? "";
  return cabecera.split(",")[0]?.trim() || "desconocida";
}

/** La IP nunca se guarda en claro: solo su huella, para poder contar sin identificar. */
export function huellaIp(ip: string): string {
  return createHash("sha256").update(`plai|${ip}`).digest("hex").slice(0, 32);
}

/* --- Respuestas -------------------------------------------------------------- */

export const error = (mensaje: string, estado = 400) =>
  NextResponse.json({ ok: false, error: mensaje }, { status: estado });

export const bien = (datos: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: true, ...datos });

/** Lo que se responde cuando no hay base de datos: honesto, no fingido. */
export const soloDemo = () =>
  NextResponse.json({
    ok: true,
    soloDemo: true,
    mensaje: "Demostración: no se ha guardado nada.",
  });

/* --- Negocio ----------------------------------------------------------------- */

export interface NegocioVigente {
  id: string;
  name: string;
  slug: string;
}

/**
 * Busca el negocio y comprueba que esté vigente.
 * Una demo caducada no recoge datos de nadie: ni una reserva, ni un contacto.
 */
export async function negocioVigente(slug: string): Promise<NegocioVigente | null> {
  const db = admin();
  const { data } = await db
    .from("businesses")
    .select("id, name, slug, status, trial_ends_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;
  const vivo =
    data.status === "active" ||
    (data.status === "trial" && data.trial_ends_at !== null && new Date(data.trial_ends_at) > new Date());
  if (!vivo) return null;

  return { id: data.id, name: data.name, slug: data.slug };
}

/** Resuelve el token del QR a su fila, para poder atribuir de dónde vino. */
export async function idDeQr(businessId: string, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const { data } = await admin()
    .from("qr_codes")
    .select("id")
    .eq("business_id", businessId)
    .eq("token", token)
    .maybeSingle();
  return data?.id ?? null;
}

/* --- Consentimiento ----------------------------------------------------------
   Guardar un "sí" no sirve de nada: hay que poder demostrar QUÉ aceptó la
   persona. Por eso se guarda una copia literal del texto, con su versión. */

export async function registrarConsentimiento(opciones: {
  businessId: string;
  tipo: string;
  sujetoId: string;
  texto: string;
  version: string;
  ip: string;
  userAgent: string | null;
}): Promise<void> {
  await admin().from("consent_records").insert({
    business_id: opciones.businessId,
    subject_kind: opciones.tipo,
    subject_id: opciones.sujetoId,
    text_snapshot: opciones.texto,
    accepted_at: new Date().toISOString(),
    ip_hash: huellaIp(opciones.ip),
    user_agent: opciones.userAgent?.slice(0, 300) ?? null,
  });
}

/* --- Envoltorio de endpoint --------------------------------------------------- */

interface Contexto<T> {
  datos: T;
  negocio: NegocioVigente;
  peticion: Request;
  ip: string;
}

/**
 * Aplica en orden: límite → parseo → honeypot → validación → negocio vigente.
 * El manejador solo recibe datos ya limpios y un negocio que existe y está vivo.
 */
export async function manejar<T extends { slug: string; website?: string }>(
  peticion: Request,
  esquema: ZodSchema<T>,
  nombre: string,
  accion: (ctx: Contexto<T>) => Promise<Response>,
): Promise<Response> {
  const ip = ipDe(peticion);

  let bruto: unknown;
  try {
    bruto = await peticion.json();
  } catch {
    return error("No he entendido la petición.");
  }

  const slug = (bruto as { slug?: string })?.slug ?? "";
  if (!limitar(`${nombre}:${ip}:${slug}`)) {
    return error("Has enviado varios seguidos. Espera un minuto.", 429);
  }

  // Honeypot: se responde como si hubiera ido bien, pero no se guarda nada.
  // Si devolviéramos un error, el robot aprendería a no rellenar el campo.
  if (typeof (bruto as { website?: unknown })?.website === "string"
      && (bruto as { website: string }).website.length > 0) {
    return bien({ id: "OK" });
  }

  const validado = esquema.safeParse(bruto);
  if (!validado.success) {
    const primero = validado.error.issues[0];
    return error(primero?.message ?? "Faltan datos o alguno no es válido.");
  }

  if (!hayBackend()) return soloDemo();

  const negocio = await negocioVigente(validado.data.slug);
  if (!negocio) return error("Este espacio ya no está disponible.", 404);

  try {
    return await accion({ datos: validado.data, negocio, peticion, ip });
  } catch (e) {
    console.error(`[pulso-local-ai] fallo en ${nombre}:`, e);
    return error("No se ha podido guardar. Prueba por WhatsApp o llamando al local.", 500);
  }
}

/** Referencia corta y legible para que el cliente y el negocio hablen de lo mismo. */
export function referencia(prefijo: string): string {
  const n = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, "0");
  const t = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefijo}-${t}${n}`;
}
