import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, cookieValida, modoAcceso } from "@/lib/sesion";

// ============================================================================
//  Middleware — la puerta del panel
// ----------------------------------------------------------------------------
//  Corre ANTES de renderizar nada, así que ninguna página del panel llega a
//  ejecutarse sin sesión. Es la diferencia entre "el panel comprueba el acceso"
//  y "no se puede llegar al panel sin acceso".
//
//  Lo público (/b/...) no pasa por aquí: tiene que ser rápido y anónimo.
// ============================================================================

export async function middleware(peticion: NextRequest) {
  const { pathname, search } = peticion.nextUrl;

  const acceso = modoAcceso(process.env);

  // Panel cerrado por configuración: no hay forma de entrar y se explica por
  // qué, en vez de dejar una puerta abierta o un error 500 sin sentido.
  if (!acceso.abierto) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: acceso.motivo }, { status: 503 });
    }
    const url = peticion.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    url.searchParams.set("cerrado", "1");
    return NextResponse.rewrite(url);
  }

  const cookie = peticion.cookies.get(COOKIE_SESION)?.value;
  const secreto = process.env.PANEL_SECRETO ?? "";

  if (await cookieValida(cookie, secreto)) return NextResponse.next();

  // A una API se le responde 401, no se la redirige: un fetch() que sigue la
  // redirección acabaría intentando parsear HTML como JSON y el error que ve
  // el usuario no tendría nada que ver con lo que pasa.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, error: "Sesión caducada. Vuelve a entrar." },
      { status: 401 },
    );
  }

  // Sin sesión: a la página de acceso, recordando a dónde quería ir.
  const url = peticion.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  url.searchParams.set("desde", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // El panel Y sus rutas de escritura. Proteger solo las páginas sería una
  // puerta con cerradura y la ventana abierta: /api/panel/* escribe en la base
  // con service_role, así que necesita exactamente la misma barrera.
  //
  // Todo lo público queda fuera a propósito: la página de un negocio y los
  // formularios de sus clientes tienen que servirse sin sesión.
  matcher: ["/dashboard/:path*", "/api/panel/:path*"],
};
