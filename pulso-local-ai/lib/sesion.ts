// ============================================================================
//  Sesión del panel
// ----------------------------------------------------------------------------
//  El panel usa service_role para leer métricas, y service_role SALTA RLS. Eso
//  significa que aquí la base ya no protege nada: quien entre en /dashboard ve
//  reservas, teléfonos y contactos de clientes reales. Así que el control de
//  acceso tiene que ser de verdad.
//
//  Dos formas de entrar, por orden de preferencia:
//
//    1. Supabase Auth — cuando el proyecto está configurado. Es lo definitivo:
//       cada persona con su cuenta, y el rol sale de business_members.
//    2. Clave de panel — mientras Supabase no exista. Mismo patrón que el panel
//       de leads de CasteBot. Se firma una cookie con HMAC para que nadie pueda
//       fabricarse una a mano.
//
//  Y la regla que evita el accidente: SIN NINGUNA DE LAS DOS, EL PANEL SE
//  CIERRA. Un despliegue al que se le olvidó poner la clave no deja el panel
//  abierto a internet; deja el panel inaccesible, que es el fallo seguro.
//
//  Web Crypto en vez de node:crypto a propósito: esto corre en el middleware,
//  que va en el runtime Edge y no tiene módulos de Node.
// ============================================================================

export const COOKIE_SESION = "plai_panel";

/** Ocho horas: una jornada. Al día siguiente se vuelve a entrar. */
const DURACION_S = 8 * 60 * 60;

function base64url(bytes: Uint8Array): string {
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function firmar(mensaje: string, secreto: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(mensaje));
  return base64url(new Uint8Array(firma));
}

/** Comparación en tiempo constante: una comparación normal filtra el secreto. */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i += 1) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

/** El valor de la cookie: "<caduca>.<firma>". */
export async function crearCookie(secreto: string, ahora = Date.now()): Promise<string> {
  const caduca = Math.floor(ahora / 1000) + DURACION_S;
  return `${caduca}.${await firmar(String(caduca), secreto)}`;
}

export async function cookieValida(
  valor: string | undefined,
  secreto: string,
  ahora = Date.now(),
): Promise<boolean> {
  if (!valor || !secreto) return false;
  const punto = valor.indexOf(".");
  if (punto < 1) return false;

  const caduca = valor.slice(0, punto);
  const firma = valor.slice(punto + 1);
  if (!/^\d+$/.test(caduca)) return false;
  if (Number(caduca) * 1000 < ahora) return false;

  return igualSeguro(firma, await firmar(caduca, secreto));
}

/* --- Configuración -----------------------------------------------------------
   Se lee de entorno y se valida, porque una clave de cuatro letras da una
   falsa sensación de seguridad que es peor que no tener ninguna. */

export interface ModoAcceso {
  /** Se puede entrar de alguna forma. */
  abierto: boolean;
  modo: "supabase" | "clave" | "cerrado";
  /** Por qué está cerrado, para poder decirlo en pantalla. */
  motivo?: string;
}

const MINIMO_CLAVE = 12;

export function modoAcceso(env: Record<string, string | undefined>): ModoAcceso {
  const claveP = env.PANEL_CLAVE ?? "";
  const secreto = env.PANEL_SECRETO ?? "";
  const haySupabaseAuth = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (claveP && secreto) {
    if (claveP.length < MINIMO_CLAVE) {
      return {
        abierto: false,
        modo: "cerrado",
        motivo: `PANEL_CLAVE es demasiado corta (${claveP.length} caracteres). Pon al menos ${MINIMO_CLAVE}.`,
      };
    }
    if (secreto.length < 32) {
      return {
        abierto: false,
        modo: "cerrado",
        motivo: "PANEL_SECRETO es demasiado corto. Genera uno de 32 caracteres o más.",
      };
    }
    return { abierto: true, modo: "clave" };
  }

  if (haySupabaseAuth && env.SUPABASE_SERVICE_ROLE_KEY) {
    return { abierto: true, modo: "supabase" };
  }

  // Fallo seguro: si nadie ha configurado cómo se entra, NO se entra.
  return {
    abierto: false,
    modo: "cerrado",
    motivo: "No hay forma de acceso configurada. Define PANEL_CLAVE y PANEL_SECRETO "
      + "(o conecta Supabase Auth) antes de usar el panel.",
  };
}
