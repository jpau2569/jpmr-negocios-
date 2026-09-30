// Perplexity para Clara: investigación con fuentes citadas y datos actuales.
// Prefiere PERPLEXITY_API_KEY (API directa); si solo hay OPENROUTER_API_KEY, va
// por OpenRouter con "perplexity/sonar-pro". Sin ninguna, avisa. Nunca inventa
// fuentes: solo devuelve las que la propia API cita.

const URL_DIRECTA = "https://api.perplexity.ai/chat/completions";
const URL_OPENROUTER = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 45000;

export function perplexityConfigurado(env = process.env) {
  return Boolean(env.PERPLEXITY_API_KEY || env.OPENROUTER_API_KEY);
}

export async function investigarConPerplexity({ consulta } = {}, env = process.env, fetchImpl = fetch) {
  const pregunta = String(consulta || "").trim().slice(0, 4000);
  if (!pregunta) return "No se recibió ninguna consulta para Perplexity.";
  const directa = Boolean(env.PERPLEXITY_API_KEY);
  const key = directa ? env.PERPLEXITY_API_KEY : env.OPENROUTER_API_KEY;
  if (!key) return "Perplexity no está configurado (falta PERPLEXITY_API_KEY, o OPENROUTER_API_KEY, en Vercel).";
  const modelo = env.PERPLEXITY_MODELO || (directa ? "sonar-pro" : "perplexity/sonar-pro");

  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resp;
  try {
    resp = await fetchImpl(directa ? URL_DIRECTA : URL_OPENROUTER, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: "system", content: "Responde en español de España, con datos actuales y verificables, de forma concisa. Si no encuentras una fuente fiable, dilo; no inventes." },
          { role: "user", content: pregunta },
        ],
        max_tokens: 2000,
      }),
    });
  } catch (e) {
    return e?.name === "AbortError" ? "Perplexity tardó demasiado y se canceló." : "No se pudo conectar con Perplexity.";
  } finally {
    clearTimeout(alarma);
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    if (resp.status === 401) return `Perplexity rechazó la clave (401). Revisa ${directa ? "PERPLEXITY_API_KEY" : "OPENROUTER_API_KEY"} en Vercel.`;
    if (resp.status === 402) return "La cuenta no tiene saldo suficiente (402).";
    if (resp.status === 429) return "Perplexity ha limitado las peticiones (429). Inténtalo en un momento.";
    return `Perplexity devolvió un error (${resp.status}).`;
  }
  const texto = String(data?.choices?.[0]?.message?.content || "").trim();
  if (!texto) return "Perplexity no devolvió texto.";
  // Fuentes: API directa → "citations" (urls); OpenRouter → annotations url_citation.
  const urls = new Set(Array.isArray(data.citations) ? data.citations.filter((u) => typeof u === "string") : []);
  for (const a of data?.choices?.[0]?.message?.annotations || []) {
    const u = a?.url_citation?.url;
    if (typeof u === "string") urls.add(u);
  }
  const fuentes = [...urls].filter((u) => /^https?:\/\//.test(u)).slice(0, 8);
  return texto.slice(0, 12000) + (fuentes.length ? "\n\nFuentes:\n" + fuentes.map((u, i) => `${i + 1}. ${u}`).join("\n") : "\n\n(Sin fuentes citadas: trátalo como no verificado.)");
}
