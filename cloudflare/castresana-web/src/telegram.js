// ============================================================================
//  Avisos a Pau por Telegram (opcionales)
// ----------------------------------------------------------------------------
//  Solo si existen los secretos TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID. Si no,
//  o si Telegram falla, no pasa nada: el dato ya está guardado en D1.
//  Se manda TEXTO PLANO (sin parse_mode), así nada de lo que escriba el
//  cliente puede inyectar formato ni enlaces disfrazados.
//  Al cliente no se le envía nada automático.
//
//  DATOS MÍNIMOS: Telegram es un tercero y los mensajes se quedan en el móvil
//  de Pau aunque luego se borren del panel. Por eso solo viaja lo justo para
//  saber que hay algo nuevo: nombre de pila, qué quiere, tipo y zona (o, en
//  las visitas, inmueble, día y hora). Nunca el correo ni el comentario. El
//  teléfono solo si Pau lo pide con la variable TELEGRAM_CON_TELEFONO=si.
// ============================================================================
import { TIPOS, OPERACIONES, textoDe, telefonoBonito } from "./validacion.js";
import { etiquetaLarga } from "./horario.js";

const MAX = 1000; // Telegram admite 4096; con datos mínimos sobra

const recorta = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

/** Solo el nombre de pila (la primera palabra). */
export const nombreDePila = (nombre) => recorta(String(nombre || "").trim().split(/\s+/)[0] || "", 40);

/** ¿Pau ha pedido que el teléfono vaya en el aviso? Solo con «si» exacto (o «sí»). */
export const conTelefono = (env) => ["si", "sí"].includes(String(env?.TELEGRAM_CON_TELEFONO || "").trim().toLowerCase());

export function textoValoracion(v, { telefono = false } = {}) {
  return recorta([
    "🏠 Nueva solicitud de VALORACIÓN",
    `Nombre: ${nombreDePila(v.nombre)}`,
    `Quiere: ${textoDe(OPERACIONES, v.operacion).toLowerCase()} · ${textoDe(TIPOS, v.tipo)}`,
    `Zona: ${recorta(String(v.zona || ""), 120)}`,
    telefono ? `Teléfono: ${telefonoBonito(v.telefono)}` : null,
    "",
    "Detalles en el panel.",
  ].filter((l) => l !== null).join("\n"), MAX);
}

export function textoVisita(v, { telefono = false } = {}) {
  const [fecha, hora] = v.fechaHora.split("T");
  return recorta([
    "📅 Nueva VISITA reservada",
    `Nombre: ${nombreDePila(v.nombre)}`,
    `Inmueble: ${v.referencia}`,
    `${etiquetaLarga(fecha)} a las ${hora}`,
    telefono ? `Teléfono: ${telefonoBonito(v.telefono)}` : null,
    "",
    "Detalles en el panel.",
  ].filter((l) => l !== null).join("\n"), MAX);
}

export const telegramActivo = (env) => Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);

/** Envía el aviso. Nunca lanza: devuelve true/false. */
export async function avisaTelegram(env, texto, hazFetch = fetch) {
  if (!telegramActivo(env)) return false;
  try {
    const r = await hazFetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: texto, disable_web_page_preview: true }),
    });
    if (!r.ok) console.warn("Telegram respondió", r.status);
    return r.ok;
  } catch (e) {
    console.warn("Telegram no disponible:", e?.message || e);
    return false;
  }
}
