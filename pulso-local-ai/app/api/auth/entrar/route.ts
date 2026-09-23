import { NextResponse } from "next/server";
import { COOKIE_SESION, crearCookie, modoAcceso } from "@/lib/sesion";
import { limitar, ipDe } from "@/lib/api";

// ============================================================================
//  Entrar al panel — /api/auth/entrar
// ----------------------------------------------------------------------------
//  Límite de intentos por IP: cinco por minuto. Sin esto, una clave se acaba
//  adivinando a fuerza de probar, y aquí detrás hay datos personales de
//  clientes reales.
//
//  La respuesta es siempre la misma frase acierte o falle la longitud, para no
//  dar pistas sobre la clave.
// ============================================================================

export const runtime = "nodejs";

export async function POST(peticion: Request) {
  const ip = ipDe(peticion);
  if (!limitar(`entrar:${ip}`, 5)) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un minuto." },
      { status: 429 },
    );
  }

  const acceso = modoAcceso(process.env);
  if (!acceso.abierto) {
    return NextResponse.json({ ok: false, error: acceso.motivo }, { status: 503 });
  }

  let clave = "";
  try {
    const cuerpo = (await peticion.json()) as { clave?: unknown };
    clave = typeof cuerpo.clave === "string" ? cuerpo.clave : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }

  const esperada = process.env.PANEL_CLAVE ?? "";
  const secreto = process.env.PANEL_SECRETO ?? "";

  // Comparación en tiempo constante: una comparación normal tarda distinto
  // según cuántos caracteres coincidan, y eso filtra la clave poco a poco.
  const a = new TextEncoder().encode(clave);
  const b = new TextEncoder().encode(esperada);
  let distinto = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    distinto |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  if (distinto !== 0) {
    return NextResponse.json({ ok: false, error: "La clave no es correcta." }, { status: 401 });
  }

  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.set({
    name: COOKIE_SESION,
    value: await crearCookie(secreto),
    httpOnly: true,              // el JavaScript de la página no puede leerla
    sameSite: "lax",             // no viaja en peticiones de otros sitios
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return respuesta;
}
