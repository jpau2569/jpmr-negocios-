"use client";

/**
 * Analítica del lado del navegador.
 *
 * `sessionId` es un identificador aleatorio guardado en `sessionStorage`: muere
 * al cerrar la pestaña, no identifica a nadie y no se comparte entre webs. Sirve
 * para no contar diez veces a la misma persona, y para nada más.
 */

const CLAVE = "pulso:sesion";

export function idSesion(): string {
  if (typeof window === "undefined") return "";
  try {
    const guardado = window.sessionStorage.getItem(CLAVE);
    if (guardado) return guardado;
    const nuevo = `s-${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    window.sessionStorage.setItem(CLAVE, nuevo);
    return nuevo;
  } catch {
    // Navegación privada con almacenamiento bloqueado: se pierde el agrupado por
    // sesión, pero la página tiene que seguir funcionando.
    return "";
  }
}

/** Código del QR por el que entró la persona, si vino por uno. */
export function codigoQr(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const enUrl = new URLSearchParams(window.location.search).get("qr");
  if (enUrl) {
    try {
      window.sessionStorage.setItem("pulso:qr", enUrl);
    } catch {
      /* sin almacenamiento, seguimos con el valor de la URL */
    }
    return enUrl;
  }
  try {
    return window.sessionStorage.getItem("pulso:qr") ?? undefined;
  } catch {
    return undefined;
  }
}

export function parametrosUtm() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource: p.get("utm_source") ?? undefined,
    utmMedium: p.get("utm_medium") ?? undefined,
    utmCampaign: p.get("utm_campaign") ?? undefined,
  };
}

export function contextoActual() {
  return {
    sessionId: idSesion(),
    qrCode: codigoQr(),
    path: typeof window === "undefined" ? undefined : window.location.pathname,
    ...parametrosUtm(),
  };
}

export async function registrar(
  businessSlug: string,
  tipo: string,
  extra: { propertyId?: string; metadata?: Record<string, string | number | boolean> } = {},
): Promise<void> {
  try {
    await fetch("/api/publico/evento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        businessSlug,
        tipo,
        sessionId: idSesion(),
        qrCode: codigoQr(),
        path: window.location.pathname,
        ...extra,
      }),
    });
  } catch {
    // Que no se registre un evento nunca puede romper la página del cliente.
  }
}
