/**
 * Lectura centralizada de variables de entorno.
 *
 * Regla que no se rompe: `SUPABASE_SERVICE_ROLE_KEY` solo se lee desde módulos
 * que corren en servidor. Si alguien la importa en un componente de cliente,
 * Next.js no la inyectará (no lleva el prefijo NEXT_PUBLIC_) y aquí falla en
 * arranque, que es mucho mejor que fallar en silencio.
 */

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Copia .env.example a .env.local y rellénala.`,
    );
  }
  return valor;
}

export const entornoPublico = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  urlApp: process.env.NEXT_PUBLIC_URL_APP ?? "http://localhost:3000",
  nombreProducto: "PULSO LOCAL AI",
};

export function entornoServidor() {
  return {
    supabaseUrl: requerida("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: requerida("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: requerida("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
    salConsentimiento: process.env.SAL_CONSENTIMIENTO ?? "pulso-local-ai-sal-por-defecto",
    whatsappSaas: process.env.WHATSAPP_SAAS ?? "",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

/** ¿Está configurada la conexión con Supabase? La demo local avisa si no. */
export function hayConfiguracionSupabase() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
