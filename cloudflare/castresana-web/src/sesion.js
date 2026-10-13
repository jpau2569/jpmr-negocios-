// ============================================================================
//  Clave del panel y cookie de sesión firmada — lógica pura (Web Crypto)
// ----------------------------------------------------------------------------
//  · La clave vive SOLO en el secreto PANEL_CLAVE; aquí no hay ninguna.
//  · La comparación es en tiempo constante: se comparan los SHA-256 de las dos
//    claves byte a byte sin salir antes, así el tiempo de respuesta no da
//    pistas ni de la clave ni de su longitud.
//  · La cookie lleva solo la caducidad y una firma HMAC-SHA256 hecha con una
//    clave derivada de PANEL_CLAVE: si Pau cambia la clave, todas las sesiones
//    abiertas dejan de valer.
//  crypto.subtle existe igual en Workers y en Node 22, así que se prueba con Node.
// ============================================================================

export const COOKIE = "__Host-panel";
export const DURACION_SESION_S = 12 * 3600;
export const LARGO_MINIMO_CLAVE = 12;

const codifica = (t) => new TextEncoder().encode(t);

function aBase64Url(bytes) {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256(texto) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", codifica(String(texto))));
}
export async function sha256Hex(texto) {
  return [...(await sha256(texto))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Igualdad de dos textos en tiempo constante (compara sus SHA-256). */
export async function igualesSeguro(a, b) {
  const [x, y] = await Promise.all([sha256(String(a ?? "")), sha256(String(b ?? ""))]);
  let diferencia = 0;
  for (let i = 0; i < x.length; i++) diferencia |= x[i] ^ y[i];
  return diferencia === 0;
}

async function firma(clavePanel, mensaje) {
  const llave = await crypto.subtle.importKey(
    "raw", codifica(`castresana-web/sesion/v1|${clavePanel}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return aBase64Url(await crypto.subtle.sign("HMAC", llave, codifica(mensaje)));
}

/** Valor de la cookie: 'v1.<caducidad en segundos>.<firma>'. */
export async function creaSesion(clavePanel, ahoraMs, duracionS = DURACION_SESION_S) {
  const caduca = Math.floor(ahoraMs / 1000) + duracionS;
  return `v1.${caduca}.${await firma(clavePanel, `panel.${caduca}`)}`;
}

/** ¿La cookie es válida y no ha caducado? */
export async function sesionValida(valor, clavePanel, ahoraMs) {
  if (!clavePanel || typeof valor !== "string") return false;
  const m = /^v1\.(\d{9,11})\.([A-Za-z0-9_-]{43})$/.exec(valor);
  if (!m) return false;
  if (Number(m[1]) * 1000 <= ahoraMs) return false;
  return igualesSeguro(m[2], await firma(clavePanel, `panel.${m[1]}`));
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
