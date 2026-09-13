import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { entornoPublico, entornoServidor } from "@/lib/entorno";

/**
 * Cliente con la sesión del usuario. Toda consulta que haga pasa por RLS con su
 * identidad: es el que usan el panel y el área de administración.
 */
export async function clienteServidor() {
  const cookieStore = await cookies();
  return createServerClient(entornoPublico.supabaseUrl, entornoPublico.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // En un Server Component no se pueden escribir cookies. El middleware
          // ya refresca la sesión, así que se puede ignorar sin perder nada.
        }
      },
    },
  });
}

/**
 * Cliente anónimo sin cookies, para leer contenido público (landing, catálogo,
 * fichas). Al no depender de la sesión, Next puede cachear estas lecturas.
 */
export function clientePublico() {
  return createClient(entornoPublico.supabaseUrl, entornoPublico.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente con service role: SALTA RLS.
 *
 * Solo puede usarse en rutas de servidor y únicamente después de haber validado
 * la entrada (Zod), comprobado honeypot y rate limit, y verificado que el
 * negocio está activo. Nunca se importa desde código de cliente.
 */
export function clienteAdmin() {
  const { supabaseUrl, serviceRoleKey } = entornoServidor();
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "pulso-local-ai/servidor" } },
  });
}
