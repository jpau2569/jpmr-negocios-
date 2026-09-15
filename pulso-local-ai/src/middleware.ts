import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * El middleware solo refresca la sesión de Supabase para que las cookies no
 * caduquen mientras alguien trabaja en el panel.
 *
 * NO decide quién entra: eso lo hacen `requerirSesionPanel()` y, por debajo,
 * RLS. Un middleware es un control de frontend con otro nombre, y los controles
 * de frontend no sostienen la seguridad de un producto multi-tenant.
 */
export async function middleware(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return respuesta;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return peticion.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => peticion.cookies.set(name, value));
        respuesta = NextResponse.next({ request: peticion });
        cookiesToSet.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return respuesta;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login"],
};
