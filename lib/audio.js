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

// Formatos que OpenRouter acepta en input_audio (respaldo).
const FORMATO_OR = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
  "audio/ogg": "ogg", "audio/opus": "ogg", "audio/flac": "flac", "audio/aac": "aac",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/webm": "webm",
};
const OPENROUTER_AUDIO_MODEL = "google/gemini-3.8-flash";

async function conTimeout(ms, fn) {
  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); } finally { clearTimeout(alarma); }
}

async function viaGemini(dataB64, tipo, key, fetchImpl) {
  return conTimeout(30000, async (signal) => {
    const resp = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_AUDIO_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: tipo, data: dataB64 } }, { text: PROMPT }] }],
          generationConfig: { temperature: 0 },
        }),
        signal,
      }
    );
    if (!resp.ok) return { error: `Gemini respondió ${resp.status}` };
    const json = await resp.json();
    const texto = (json?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || "").join("").trim();
    return texto ? { texto: texto.slice(0, 12000) } : { error: "Gemini no devolvió texto" };
  });
}

// Respaldo: el mismo modelo de Google, pero pagado por OpenRouter (no gasta la
// cuota de Google AI Studio).
async function viaOpenRouter(dataB64, tipo, key, fetchImpl) {
  const formato = FORMATO_OR[tipo];
  if (!formato) return { error: "formato no admitido por el respaldo" };
  return conTimeout(40000, async (signal) => {
    const resp = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENROUTER_AUDIO_MODEL,
        temperature: 0,
        messages: [{ role: "user", content: [
          { type: "text", text: PROMPT },
          { type: "input_audio", input_audio: { data: dataB64, format: formato } },
        ] }],
      }),
      signal,
    });
    if (!resp.ok) return { error: `OpenRouter respondió ${resp.status}` };
    const json = await resp.json();
    const texto = String(json?.choices?.[0]?.message?.content || "").trim();
    return texto ? { texto: texto.slice(0, 12000) } : { error: "OpenRouter no devolvió texto" };
  });
}

export async function transcribirAudio(
  dataB64,
  mediaType,
  { fetchImpl = fetch, key = process.env.GEMINI_API_KEY, orKey = process.env.OPENROUTER_API_KEY } = {}
) {
  const tipo = tipoAudio(mediaType);
  if (!tipo) return { error: "formato de audio no compatible" };
  if (!key && !orKey) return { error: "falta GEMINI_API_KEY (u OPENROUTER_API_KEY) en Vercel, así que no puedo transcribir audios" };
  const intentar = async (fn, k) => {
    try { return await fn(dataB64, tipo, k, fetchImpl); }
    catch (e) { return { error: e?.name === "AbortError" ? "la transcripción tardó demasiado" : "no se pudo transcribir" }; }
  };
  let r = key ? await intentar(viaGemini, key) : { error: "sin GEMINI_API_KEY" };
  if (r.texto || !orKey) return r;
  const alt = await intentar(viaOpenRouter, orKey);
  if (alt.texto) return alt;
  return { error: `${r.error}; respaldo: ${alt.error}` };
}
