import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Solo claves PÚBLICAS. La seguridad real la da la RLS de Supabase.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let cliente: SupabaseClient | null = null;

export function configurado(): boolean {
  return Boolean(SUPABASE_URL && ANON);
}

export function supabase(): SupabaseClient {
  if (!configurado()) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  cliente ??= createClient(SUPABASE_URL, ANON, { auth: { persistSession: true, autoRefreshToken: true } });
  return cliente;
}

export const ANON_KEY_PUBLICA = ANON;

/** Mensaje legible de un error de Supabase/PostgREST. */
export function mensajeError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Error desconocido";
}
