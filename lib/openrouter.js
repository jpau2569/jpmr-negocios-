// ============================================================================
//  OpenRouter para Clara — segunda opinión de otros modelos de IA
// ----------------------------------------------------------------------------
//  Con OPENROUTER_API_KEY (Vercel), Clara puede consultar a otro modelo (GPT,
//  Gemini, DeepSeek…) para contrastar un análisis, pedir otra versión de un
//  texto o comparar enfoques. API compatible con OpenAI:
//  POST https://openrouter.ai/api/v1/chat/completions con "Authorization: Bearer".
//
//  Modelo por defecto: OPENROUTER_MODELO o "openrouter/auto" (el enrutador de
//  OpenRouter elige el más adecuado para cada pregunta). Los nombres de modelo
//  llevan el prefijo de la empresa, p. ej. "openai/…", "google/…".
// ============================================================================

const URL_API = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 40000;

export function openrouterConfigurado(env = process.env) {
  return Boolean(env.OPENROUTER_API_KEY);
}

export async function consultarModelo({ pregunta, modelo, contexto } = {}, env = process.env) {
  const key = env.OPENROUTER_API_KEY;
  if (!key) return "OpenRouter no está configurado (falta OPENROUTER_API_KEY en Vercel).";
  const texto = String(pregunta || "").trim().slice(0, 12000);
  if (!texto) return "No se recibió ninguna pregunta para el otro modelo.";
  const elegido = String(modelo || env.OPENROUTER_MODELO || "openrouter/auto").trim();
  if (!/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i.test(elegido)) {
    return `El nombre de modelo "${elegido}" no es válido: debe ser tipo "empresa/modelo" (p. ej. "openrouter/auto").`;
  }

  const messages = [
    {
      role: "system",
      content:
        "Responde en español de España, con precisión y de forma concisa. Si no sabes algo o no puedes verificarlo, dilo claramente; no inventes datos.",
    },
  ];
  const ctx = String(contexto || "").trim().slice(0, 12000);
  if (ctx) messages.push({ role: "user", content: `Contexto:\n${ctx}` });
  messages.push({ role: "user", content: texto });

  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(URL_API, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.asesoriacastresana.com",
        "X-OpenRouter-Title": "Clara",
      },
      body: JSON.stringify({ model: elegido, messages, max_tokens: 3000 }),
    });
  } catch (e) {
    if (e?.name === "AbortError") return "El otro modelo tardó demasiado en responder y se canceló.";
    return "No se pudo conectar con OpenRouter: " + String(e?.message || e);
  } finally {
    clearTimeout(alarma);
  }

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = String(data?.error?.message || "").slice(0, 200);
    if (resp.status === 401) return "OpenRouter rechazó la clave (401). Revisa OPENROUTER_API_KEY en Vercel.";
    if (resp.status === 402) return "La cuenta de OpenRouter no tiene saldo suficiente (402). Recárgala en openrouter.ai.";
    if (resp.status === 429) return "OpenRouter ha limitado las peticiones (429). Inténtalo en un momento.";
    return `OpenRouter devolvió un error (${resp.status}) con el modelo "${elegido}". ${msg}`.trim();
  }
  const respuesta = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!respuesta) return `El modelo "${elegido}" no devolvió texto.`;
  const usado = data?.model || elegido;
  return `Respuesta de ${usado} (vía OpenRouter):\n\n${respuesta.slice(0, 15000)}`;
}
