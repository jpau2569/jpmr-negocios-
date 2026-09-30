// Oídos de Clara: transcribe notas de voz y audios (WhatsApp, grabadora del
// móvil…) con Gemini. La clave vive en GEMINI_API_KEY, nunca en el navegador.
// Sin clave, o si Gemini falla, devuelve un aviso claro: nunca inventa lo que
// dice el audio.

// Tipos aceptados (el navegador puede añadir parámetros: "audio/ogg; codecs=opus").
export const AUDIO_TIPOS = new Set([
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac",
  "audio/ogg", "audio/opus", "audio/wav", "audio/x-wav", "audio/webm", "audio/flac",
]);

export function tipoAudio(mediaType) {
  const t = String(mediaType || "").split(";")[0].trim().toLowerCase();
  return AUDIO_TIPOS.has(t) ? t : null;
}

const GEMINI_AUDIO_MODEL =  "gemini-3.8-flash";
const PROMPT =
  "Transcribe literalmente este audio, en el idioma en que se habla. Devuelve SOLO la transcripción, " +
  "sin comentarios. Si hay varias personas, sepáralas por líneas con «—». Si una parte no se entiende, " +
  "escribe [inaudible]; no rellenes ni supongas nada. Si no hay voz, responde exactamente: [sin voz]";

export async function transcribirAudio(dataB64, mediaType, { fetchImpl = fetch, key = process.env.GEMINI_API_KEY } = {}) {
  const tipo = tipoAudio(mediaType);
  if (!tipo) return { error: "formato de audio no compatible" };
  if (!key) return { error: "falta GEMINI_API_KEY en Vercel, así que no puedo transcribir audios" };
  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), 30000);
  try {
    const resp = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_AUDIO_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: tipo, data: dataB64 } }, { text: PROMPT }] }],
          generationConfig: { temperature: 0 },
        }),
        signal: ctrl.signal,
      }
    );
    if (!resp.ok) return { error: `Gemini respondió ${resp.status}` };
    const json = await resp.json();
    const texto = (json?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || "").join("").trim();
    if (!texto) return { error: "Gemini no devolvió texto" };
    return { texto: texto.slice(0, 12000) };
  } catch (e) {
    return { error: e?.name === "AbortError" ? "la transcripción tardó demasiado" : "no se pudo transcribir" };
  } finally {
    clearTimeout(alarma);
  }
}
