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
    const url = peticion.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    url.searchParams.set("cerrado", "1");
    return NextResponse.rewrite(url);
  }

  const cookie = peticion.cookies.get(COOKIE_SESION)?.value;
  const secreto = process.env.PANEL_SECRETO ?? "";

  if (await cookieValida(cookie, secreto)) return NextResponse.next();

  // Sin sesión: a la página de acceso, recordando a dónde quería ir.
  const url = peticion.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  url.searchParams.set("desde", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Solo el panel. Todo lo público queda fuera a propósito: la página de un
  // negocio tiene que servirse sin pasar por ninguna comprobación.
  matcher: ["/dashboard/:path*"],
};
