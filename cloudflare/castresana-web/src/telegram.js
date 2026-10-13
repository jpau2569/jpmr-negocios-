// ============================================================================
//  Avisos a Pau por Telegram (opcionales)
// ----------------------------------------------------------------------------
//  Solo si existen los secretos TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID. Si no,
//  o si Telegram falla, no pasa nada: el dato ya está guardado en D1.
//  Se manda TEXTO PLANO (sin parse_mode), así nada de lo que escriba el
//  cliente puede inyectar formato ni enlaces disfrazados.
//  Al cliente no se le envía nada automático.
// ============================================================================
import { TIPOS, OPERACIONES, textoDe, telefonoBonito } from "./validacion.js";
import { etiquetaLarga } from "./horario.js";

const MAX = 3500; // Telegram admite 4096; dejamos margen

const recorta = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

export function textoValoracion(v) {
  return recorta([
    "🏠 Nueva solicitud de VALORACIÓN",
    `Nombre: ${v.nombre}`,
    `Teléfono: ${telefonoBonito(v.telefono)}`,
    v.correo ? `Correo: ${v.correo}` : null,
    `Quiere: ${textoDe(OPERACIONES, v.operacion).toLowerCase()} · ${textoDe(TIPOS, v.tipo)}`,
    `Zona: ${v.zona}`,
    v.metros ? `Metros: ${v.metros} m²` : null,
    v.habitaciones !== null && v.habitaciones !== undefined ? `Habitaciones: ${v.habitaciones}` : null,
    v.comentario ? `Comentario: ${recorta(v.comentario, 1200)}` : null,
    "",
    "Está en el panel → Valoraciones.",
  ].filter((l) => l !== null).join("\n"), MAX);
}

export function textoVisita(v) {
  const [fecha, hora] = v.fechaHora.split("T");
  return recorta([
    "📅 Nueva VISITA reservada",
    `${etiquetaLarga(fecha)} a las ${hora}`,
    `Inmueble: ${v.referencia}${v.titulo ? ` · ${v.titulo}` : ""}`,
    `Nombre: ${v.nombre}`,
    `Teléfono: ${telefonoBonito(v.telefono)}`,
    v.comentario ? `Comentario: ${recorta(v.comentario, 600)}` : null,
    "",
    "Está en el panel → Visitas.",
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
