// ============================================================================
//  Clientes de Supabase
// ----------------------------------------------------------------------------
//  Dos clientes y una regla que no se rompe:
//
//    cliente()  → clave anon. Es el que usan las páginas públicas. Está sujeto
//                 a RLS, así que aunque una consulta se escriba mal, no puede
//                 devolver datos de otro negocio ni un dato personal.
//
//    admin()    → service_role. SALTA RLS. Solo se usa en Route Handlers, para
//                 escribir lo que el público envía (una reserva, un feedback)
//                 y para leer lo que el asistente necesita. Nunca en un
//                 componente que pueda acabar en el navegador.
//
//  La clave de servicio no lleva prefijo NEXT_PUBLIC_, así que Next se niega a
//  incluirla en el bundle del cliente. Además, este módulo es server-only.
// ============================================================================

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function exigir(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copia .env.example a .env.local y rellénala.`,
    );
  }
  return valor;
}

/** Cliente público: sujeto a RLS. Para leer contenido publicado. */
export function cliente(): SupabaseClient {
  return createClient(
    exigir("NEXT_PUBLIC_SUPABASE_URL"),
    exigir("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } },
  );
}

/**
 * Cliente de servicio: SALTA RLS.
 * Solo para Route Handlers. Cada uso debe filtrar por business_id a mano,
 * porque aquí la base ya no protege por ti.
 */
export function admin(): SupabaseClient {
  return createClient(
    exigir("NEXT_PUBLIC_SUPABASE_URL"),
    exigir("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** ¿Está configurado Supabase? Sin esto la app funciona en modo demostración. */
export function haySupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
