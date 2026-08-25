// ============================================================================
//  CASTEBOT — Red de 6 agentes IA de Asesoría Castresana (Vercel + Claude)
// ----------------------------------------------------------------------------
//  Proxy seguro: la clave vive en ANTHROPIC_API_KEY (Vercel → Settings →
//  Environment Variables). El frontend (castebot.html) envía el agente elegido
//  y el historial; aquí se compone el system prompt leyendo los prompts
//  maestros canónicos de la carpeta `agentes/`:
//      agentes/_comunes.md  +  agentes/<agente>.md
//  (vercel.json incluye la carpeta en el bundle con "includeFiles").
//
//  Hot-lead → aviso a Telegram (reutiliza castresana-bot): si el agente marca
//  la conversación como hot-lead, añade al final un bloque [[HOTLEAD]]…
//  [[/HOTLEAD]] que aquí se extrae, se envía a Telegram (TELEGRAM_BOT_TOKEN +
//  TELEGRAM_CHAT_ID) y se oculta al cliente.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";

export const config = { supportsResponseStreaming: true };

const MODEL = "claude-sonnet-5";
const MAX_HISTORY = 40; // últimos N mensajes que se envían al modelo
const MAX_TOKENS = 1500; // los agentes responden en mensajes cortos, tipo WhatsApp

// Agentes disponibles → archivo con su prompt maestro. Cualquier otro valor
// del frontend se rechaza (nunca se lee un archivo arbitrario del disco).
const AGENTES = {
  juanjo: { archivo: "juanjo.md", nombre: "JUANJO", rol: "Captador" },
  javi: { archivo: "javi.md", nombre: "JAVI", rol: "Valorador" },
  alejandro: { archivo: "alejandro.md", nombre: "ALEJANDRO", rol: "Asesor y documental" },
  pau: { archivo: "pau-bot.md", nombre: "PAU", rol: "Seguimiento y cierre" },
  nuria: { archivo: "nuria.md", nombre: "NURIA", rol: "Alquileres" },
  nicer: { archivo: "nicer.md", nombre: "NICER", rol: "Marketing e informes" },
};

// Instrucción que solo existe en el backend: cómo avisar de un hot-lead sin
// que el cliente lo vea. El formato del aviso vive en agentes/_comunes.md.
const INSTRUCCION_HOTLEAD = `## Mecanismo técnico del hot-lead (no lo menciones al cliente)
Cuando la conversación cumpla tus criterios de hot-lead, añade AL FINAL de tu
respuesta, después de tu mensaje normal al cliente, un bloque exactamente así:

[[HOTLEAD]]
🔥 HOT-LEAD [TU NOMBRE]
Nombre: …
Teléfono/canal: …
Qué quiere: …
Dato clave: …
Siguiente paso propuesto: …
[[/HOTLEAD]]

El sistema extrae ese bloque, lo envía por Telegram al despacho y lo oculta al
cliente. Emítelo UNA sola vez por conversación (cuando se cumplan los criterios
por primera vez o cuando haya un dato nuevo importante, p. ej. expediente
completo). No hables nunca de este mecanismo con el cliente.`;

// ---------------------------------------------------------------------------
//  Carga de prompts maestros (cacheados en memoria entre invocaciones)
// ---------------------------------------------------------------------------
const cachePrompts = new Map();

function leerPrompt(archivo) {
  if (!cachePrompts.has(archivo)) {
    const ruta = path.join(process.cwd(), "agentes", archivo);
    cachePrompts.set(archivo, readFileSync(ruta, "utf8"));
  }
  return cachePrompts.get(archivo);
}

function fechaDeHoy() {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Madrid",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// ---------------------------------------------------------------------------
//  Aviso a Telegram (reutiliza el bot del despacho: castresana-bot)
// ---------------------------------------------------------------------------
async function avisarTelegram(texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("Hot-lead detectado pero Telegram no está configurado (faltan TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).");
    return false;
  }
  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), 10000);
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto.slice(0, 4000) }),
    });
    if (!resp.ok) {
      console.error("Telegram rechazó el aviso de hot-lead:", resp.status, await resp.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("No se pudo enviar el hot-lead a Telegram:", String(e?.message || e));
    return false;
  } finally {
    clearTimeout(alarma);
  }
}

// Extrae el bloque [[HOTLEAD]]…[[/HOTLEAD]] de la respuesta completa.
// Devuelve { visible, hotlead } — visible es lo que ve el cliente.
const RE_HOTLEAD = /\[\[HOTLEAD\]\]([\s\S]*?)(?:\[\[\/HOTLEAD\]\]|$)/;

export function separarHotlead(texto) {
  const m = texto.match(RE_HOTLEAD);
  if (!m) return { visible: texto.trim(), hotlead: null };
  return {
    visible: texto.replace(RE_HOTLEAD, "").trim(),
    hotlead: m[1].trim() || null,
  };
}

// En streaming se retienen los últimos caracteres emitidos para poder cortar
// justo antes de un "[[HOTLEAD]]" aunque el marcador llegue partido en trozos.
const MARGEN_MARCADOR = "[[HOTLEAD]]".length;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "Falta la clave de Anthropic. Añádela en Vercel → Settings → Environment Variables como ANTHROPIC_API_KEY y vuelve a desplegar.",
    });
  }

  const { agente, messages, stream } = req.body ?? {};
  const ficha = AGENTES[String(agente || "").toLowerCase().trim()];
  if (!ficha) {
    return res.status(400).json({
      error: "Agente no válido. Usa uno de: " + Object.keys(AGENTES).join(", ") + ".",
    });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Envía un array 'messages' con la conversación." });
  }

  // Saneamos el historial: solo roles y texto válidos, acotado.
  const history = messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (history.length === 0 || history[0].role !== "user") {
    return res.status(400).json({ error: "La conversación debe empezar con un mensaje del usuario." });
  }

  let comunes, propio;
  try {
    comunes = leerPrompt("_comunes.md");
    propio = leerPrompt(ficha.archivo);
  } catch (e) {
    console.error("No se pudo leer un prompt maestro:", String(e?.message || e));
    return res.status(500).json({
      error: "No se pudieron cargar los prompts de los agentes. Revisa que la carpeta agentes/ esté desplegada (includeFiles en vercel.json).",
    });
  }

  // Reglas comunes + prompt del agente van cacheados (largos y estables);
  // la fecha y la mecánica de hot-lead, en bloques aparte.
  const system = [
    { type: "text", text: comunes + "\n\n---\n\n" + propio, cache_control: { type: "ephemeral" } },
    { type: "text", text: INSTRUCCION_HOTLEAD },
    { type: "text", text: `Hoy es ${fechaDeHoy()} (hora de Madrid).` },
  ];

  const request = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: history,
  };

  const RESPUESTA_RECHAZO =
    "Disculpa, eso no puedo atenderlo por aquí. Si quieres, te pongo en contacto con el equipo del despacho: 📞 Asesoría Castresana.";

  try {
    const client = new Anthropic();

    // ---- Modo streaming (SSE) ----
    if (stream === true) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      const emite = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      let completo = "";
      let emitido = 0; // cuántos caracteres de `completo` se han enviado ya
      try {
        const flujo = client.messages.stream(request);
        flujo.on("text", (delta) => {
          completo += delta;
          // Si ya asoma el marcador, no se emite nada desde su inicio; si no,
          // se retiene un pequeño margen por si llega partido entre deltas.
          const idx = completo.indexOf("[[HOTLEAD");
          const limite = idx >= 0 ? idx : Math.max(emitido, completo.length - MARGEN_MARCADOR);
          if (limite > emitido) {
            emite({ t: completo.slice(emitido, limite) });
            emitido = limite;
          }
        });
        const response = await flujo.finalMessage();
        const { visible, hotlead } = separarHotlead(completo);
        const reply = visible || (response?.stop_reason === "refusal" ? RESPUESTA_RECHAZO : RESPUESTA_RECHAZO);
        if (hotlead) await avisarTelegram(hotlead);
        emite({ done: true, reply });
      } catch (e) {
        console.error("Error en streaming de /api/castebot:", e);
        emite({ error: "El asistente ha tenido un problema al responder. Inténtalo de nuevo en un momento." });
      }
      return res.end();
    }

    // ---- Modo clásico (JSON) ----
    const response = await client.messages.create(request);
    const bruto = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const { visible, hotlead } = separarHotlead(bruto);
    if (hotlead) await avisarTelegram(hotlead);

    if (response.stop_reason === "refusal" || !visible) {
      return res.status(200).json({ reply: RESPUESTA_RECHAZO, agente: ficha.nombre });
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ reply: visible, agente: ficha.nombre });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "La clave ANTHROPIC_API_KEY no es válida. Revísala en Vercel." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Demasiadas peticiones seguidas. Espera unos segundos y vuelve a intentarlo." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Error de la API de Claude en /api/castebot:", err.status, err.message);
      return res.status(502).json({ error: `La API de Claude devolvió un error (${err.status}). Inténtalo de nuevo en un momento.` });
    }
    console.error("Error interno en /api/castebot:", err);
    return res.status(500).json({ error: "Error interno del asistente.", detail: String(err?.message || err) });
  }
}
