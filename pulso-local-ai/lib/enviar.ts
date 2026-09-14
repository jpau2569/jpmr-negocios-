"use client";

// ============================================================================
//  Envío de formularios públicos
// ----------------------------------------------------------------------------
//  Un único camino para los cuatro formularios: reserva, grupo, opinión y alta
//  en novedades. Recoge los UTM y el QR de origen sin que el formulario tenga
//  que acordarse, y traduce cualquier fallo a una frase que entienda una
//  persona, no un stack trace.
// ============================================================================

export interface Respuesta {
  ok: boolean;
  id?: string;
  mensaje?: string;
  /** true cuando no hay backend: se ha enseñado la demo, no se ha guardado. */
  soloDemo?: boolean;
}

function utmActuales(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const salida: Record<string, string> = {};
  for (const clave of ["utm_source", "utm_medium", "utm_campaign"]) {
    const valor = p.get(clave);
    if (valor) salida[clave] = valor.slice(0, 60);
  }
  return salida;
}

function qrDeSesion(slug: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const p = new URLSearchParams(window.location.search).get("qr");
  if (p) return p;
  try {
    return sessionStorage.getItem(`plai:qr:${slug}`) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function enviar(
  ruta: string,
  slug: string,
  datos: Record<string, unknown>,
): Promise<Respuesta> {
  const cuerpo = {
    ...datos,
    slug,
    qr: qrDeSesion(slug),
    utm: utmActuales(),
  };

  try {
    const r = await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

    const json = (await r.json().catch(() => ({}))) as Partial<Respuesta> & { error?: string };

    if (!r.ok) {
      if (r.status === 429) {
        return { ok: false, mensaje: "Has enviado varios seguidos. Espera un minuto y vuelve a probar." };
      }
      return {
        ok: false,
        mensaje: json.error ?? "No se ha podido enviar. Prueba por WhatsApp o llamando.",
      };
    }

    return { ok: true, id: json.id, soloDemo: json.soloDemo, mensaje: json.mensaje };
  } catch {
    // Sin cobertura en el bajo del bar: pasa constantemente.
    return {
      ok: false,
      mensaje: "No hay conexión ahora mismo. Prueba por WhatsApp o llamando al local.",
    };
  }
}
