// ============================================================================
//  Claves, agentes y cookie de sesión firmada — lógica pura (Web Crypto)
// ----------------------------------------------------------------------------
//  · La clave del TITULAR vive SOLO en el secreto PANEL_CLAVE (como en
//    castresana-web). Se compara en tiempo constante.
//  · Los demás AGENTES (opcionales) tienen su propia clave, que se guarda en
//    D1 como PBKDF2-SHA256 con sal aleatoria (100.000 vueltas, el máximo que
//    admite Workers). Nunca se guarda la clave en claro.
//  · La cookie `__Host-sesion` lleva la caducidad, el agente y su «versión»,
//    firmados con HMAC-SHA256 con una clave derivada de PANEL_CLAVE:
//      - si cambia PANEL_CLAVE, se cierran TODAS las sesiones;
//      - si a un agente se le cambia la clave o se le da de baja, sube su
//        versión y se cierran las suyas.
//  crypto.subtle existe igual en Workers y en Node 22, así que se prueba con Node.
// ============================================================================

export const COOKIE = "__Host-sesion";
export const DURACION_SESION_S = 7 * 86400; // una semana: el móvil es del agente
export const LARGO_MINIMO_CLAVE = 12;        // PANEL_CLAVE
export const LARGO_MINIMO_CLAVE_AGENTE = 10;
export const ITERACIONES_PBKDF2 = 100_000;   // Workers no admite más

const codifica = (t) => new TextEncoder().encode(t);
const aHex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const deHex = (hex) => new Uint8Array((String(hex).match(/../g) || []).map((h) => parseInt(h, 16)));

function aBase64Url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(texto) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", codifica(String(texto))));
}

/** Igualdad de dos textos en tiempo constante (compara sus SHA-256). */
export async function igualesSeguro(a, b) {
  const [x, y] = await Promise.all([sha256(String(a ?? "")), sha256(String(b ?? ""))]);
  let diferencia = 0;
  for (let i = 0; i < x.length; i++) diferencia |= x[i] ^ y[i];
  return diferencia === 0;
}

/** HMAC-SHA256 en hexadecimal (para la IP: sin la clave no se sabe cuál era). */
export async function hmacHex(clave, mensaje) {
  const llave = await crypto.subtle.importKey("raw", codifica(String(clave)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return aHex(await crypto.subtle.sign("HMAC", llave, codifica(String(mensaje))));
}

// ---- Claves de los agentes (PBKDF2) -------------------------------------------
async function pbkdf2(clave, salBytes, iteraciones) {
  const base = await crypto.subtle.importKey("raw", codifica(String(clave)), "PBKDF2", false, ["deriveBits"]);
  return aHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salBytes, iterations: iteraciones }, base, 256));
}

/** { sal, hash, iteraciones } para guardar en D1. */
export async function resumeClave(clave, iteraciones = ITERACIONES_PBKDF2) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return { sal: aHex(sal), hash: await pbkdf2(clave, sal, iteraciones), iteraciones };
}

/** ¿La clave coincide con lo guardado? (comparación en tiempo constante). */
export async function compruebaClave(clave, guardado) {
  if (!guardado?.sal || !guardado?.hash) return false;
  const calculado = await pbkdf2(clave, deHex(guardado.sal), Number(guardado.iteraciones) || ITERACIONES_PBKDF2);
  return igualesSeguro(calculado, guardado.hash);
}

/**
 * Cuando el usuario no existe se hace el mismo trabajo con una sal de
 * relleno: así el tiempo de respuesta no dice qué usuarios existen.
 */
export const GUARDADO_DE_RELLENO = Object.freeze({ sal: "00112233445566778899aabbccddeeff", hash: "0".repeat(64), iteraciones: ITERACIONES_PBKDF2 });

export function validaClaveAgente(clave) {
  const c = String(clave ?? "");
  if (c.length < LARGO_MINIMO_CLAVE_AGENTE) return `La clave tiene que tener al menos ${LARGO_MINIMO_CLAVE_AGENTE} caracteres (mejor una frase de 3 o 4 palabras).`;
  if (c.length > 200) return "La clave es demasiado larga.";
  return "";
}

// ---- Cookie de sesión ------------------------------------------------------------
async function firma(clavePanel, mensaje) {
  const llave = await crypto.subtle.importKey(
    "raw", codifica(`hojas-firmadas/sesion/v1|${clavePanel}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return aBase64Url(await crypto.subtle.sign("HMAC", llave, codifica(mensaje)));
}

/** Valor de la cookie: 'v1.<caducidad>.<agente>.<versión>.<firma>' (agente 0 = titular). */
export async function creaSesion(clavePanel, ahoraMs, { agente = 0, version = 0 } = {}, duracionS = DURACION_SESION_S) {
  const caduca = Math.floor(ahoraMs / 1000) + duracionS;
  return `v1.${caduca}.${agente}.${version}.${await firma(clavePanel, `sesion.${caduca}.${agente}.${version}`)}`;
}

/** Devuelve { agente, version } si la cookie es válida y no ha caducado; si no, null. */
export async function leeSesion(valor, clavePanel, ahoraMs) {
  if (!clavePanel || typeof valor !== "string") return null;
  const m = /^v1\.(\d{9,11})\.(\d{1,9})\.(\d{1,9})\.([A-Za-z0-9_-]{43})$/.exec(valor);
  if (!m) return null;
  if (Number(m[1]) * 1000 <= ahoraMs) return null;
  const ok = await igualesSeguro(m[4], await firma(clavePanel, `sesion.${m[1]}.${m[2]}.${m[3]}`));
  return ok ? { agente: Number(m[2]), version: Number(m[3]) } : null;
}

export function cabeceraCookie(valor, maxAgeS = DURACION_SESION_S) {
  return `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeS}`;
}
export const cabeceraBorrarCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function leeCookie(cabecera, nombre = COOKIE) {
  for (const trozo of String(cabecera || "").split(";")) {
    const i = trozo.indexOf("=");
    if (i > 0 && trozo.slice(0, i).trim() === nombre) return trozo.slice(i + 1).trim();
  }
  return "";
}

/** Usuario de un agente: minúsculas, cifras, punto, guion y guion bajo (3 a 30). */
export const esUsuario = (u) => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(String(u ?? ""));
