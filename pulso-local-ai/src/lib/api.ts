import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { dentroDelCupo, ipDePeticion } from "@/lib/rate-limit";
import { esBot } from "@/lib/validaciones/comunes";
import { ErrorCaptacion } from "@/lib/captacion";

/**
 * Envoltorio común de los endpoints públicos. Hace, en este orden:
 *
 *   1. Cupo por IP (hasheada) y por endpoint.
 *   2. Validación con Zod. Lo que no valide, no entra.
 *   3. Honeypot. Si lo rellenaron, se responde «ok» sin guardar nada: contestar
 *      con un error solo le diría al bot qué campo evitar la próxima vez.
 *
 * Los mensajes de error que salen al exterior son genéricos; el detalle se
 * queda en los logs del servidor.
 */

export function ok<T extends Record<string, unknown>>(datos: T, estado = 200) {
  return NextResponse.json({ ok: true, ...datos }, { status: estado });
}

export function error(mensaje: string, estado = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: mensaje, ...extra }, { status: estado });
}

export interface OpcionesEndpoint {
  ambito: string;
  limite?: number;
  ventanaSegundos?: number;
}

export async function manejarFormulario<E extends ZodTypeAny>(
  peticion: Request,
  esquema: E,
  opciones: OpcionesEndpoint,
  accion: (datos: z.infer<E>) => Promise<NextResponse>,
): Promise<NextResponse> {
  const dentro = await dentroDelCupo({
    ambito: opciones.ambito,
    identificador: ipDePeticion(peticion),
    limite: opciones.limite ?? 5,
    ventanaSegundos: opciones.ventanaSegundos ?? 600,
  });
  if (!dentro) {
    return error("Has enviado demasiadas solicitudes seguidas. Inténtalo de nuevo en unos minutos.", 429);
  }

  let cuerpo: unknown;
  try {
    cuerpo = await peticion.json();
  } catch {
    return error("Solicitud mal formada", 400);
  }

  if (esBot((cuerpo as { companyWebsite?: unknown })?.companyWebsite)) {
    return ok({ mensaje: "Recibido" });
  }

  try {
    const datos = esquema.parse(cuerpo) as z.infer<E>;
    return await accion(datos);
  } catch (err) {
    if (err instanceof ZodError) {
      const campos: Record<string, string> = {};
      for (const issue of err.issues) {
        const clave = issue.path.join(".") || "formulario";
        if (!campos[clave]) campos[clave] = issue.message;
      }
      return error("Revisa los datos del formulario", 422, { campos });
    }
    if (err instanceof ErrorCaptacion) {
      return error(err.message, err.estado);
    }
    console.error("[pulso-local-ai] error en endpoint público", opciones.ambito, err);
    return error("No se ha podido completar la solicitud", 500);
  }
}
