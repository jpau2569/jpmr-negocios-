"use client";

import { createBrowserClient } from "@supabase/ssr";
import { entornoPublico } from "@/lib/entorno";

/** Cliente del navegador. Solo con clave anónima: nunca lleva secretos. */
export function clienteNavegador() {
  return createBrowserClient(entornoPublico.supabaseUrl, entornoPublico.supabaseAnonKey);
}
