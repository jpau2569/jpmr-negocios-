// ============================================================================
//  Aviso por Telegram de cada hoja firmada (opcional)
// ----------------------------------------------------------------------------
//  Solo si existen los secretos TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID. Si no,
//  o si Telegram falla, no pasa nada: la hoja ya está guardada en D1.
//  DATOS MÍNIMOS (Telegram es un tercero y el mensaje se queda en el móvil):
//  tipo de hoja, nombre de pila y referencia del piso. Nunca DNI, teléfono,
//  correo, dirección ni firmas. Texto plano (sin parse_mode).
//  Al cliente no se le envía nada automático.
// ============================================================================
import { TIPOS, nombreDePila, resumenHoja } from "../public/static/nucleo/hoja.js";

export const telegramActivo = (env) => Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);

export function textoHojaFirmada(hoja) {
  const r = resumenHoja(hoja);
  return [
    `✍️ ${TIPOS[hoja.tipo]} firmada`,
    `Nombre: ${nombreDePila(r.nombre)}`,
    `Referencia: ${String(r.referencia || "sin referencia").slice(0, 40)}`,
    "",
    "Detalles en la app.",
  ].join("\n");
}

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
