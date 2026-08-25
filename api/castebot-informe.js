// ============================================================================
//  Informe diario de NICER (CasteBot) — el informe de las 8:00
// ----------------------------------------------------------------------------
//  Un cron de Vercel (ver vercel.json) llama aquí cada mañana, después del
//  briefing de Clara. NICER resume la actividad de la red de agentes:
//  1. Lee de Supabase el resumen agregado de hot-leads (RPC
//     castebot_leads_resumen — solo totales por agente, sin datos personales).
//  2. Si hay ANTHROPIC_API_KEY, NICER lo redacta con su voz (prompt maestro
//     de agentes/nicer.md) y sus 1-3 recomendaciones del día.
//  3. Si hay TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, lo envía al Telegram del
//     despacho; si no, la respuesta JSON devuelve el informe.
//
//  Protección: CRON_SECRET obligatoria, igual que /api/briefing.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { nubeConfigurada, rpc } from "../lib/memoria.js";

function fechaDeHoy() {
  try {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeZone: "Europe/Madrid" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const AGENTES_ORDEN = ["JUANJO", "JAVI", "NURIA", "ALEJANDRO", "PAU"];

// Convierte el resumen agregado de Supabase en líneas por agente.
function lineasActividad(resumen) {
  const hoy = new Map((resumen?.hoy || []).map((r) => [String(r.agente).toUpperCase(), r.total]));
  const semana = new Map((resumen?.semana || []).map((r) => [String(r.agente).toUpperCase(), r.total]));
  return AGENTES_ORDEN.map((a) => {
    const h = hoy.get(a) || 0;
    const s = semana.get(a) || 0;
    return `${a}: ${h} hot-lead${h === 1 ? "" : "s"} en las últimas 24 h (${s} en 7 días)`;
  });
}

// Informe de respaldo, sin IA: datos puros.
function informeBasico(resumen) {
  const lineas = [`📊 CASTRESANA — ${fechaDeHoy()}`, ""];
  if (!resumen) {
    lineas.push("Sin datos de actividad: la nube (Supabase) no está configurada o aún no hay hot-leads registrados.");
  } else {
    lineas.push(...lineasActividad(resumen));
    const total = resumen.total_semana || 0;
    lineas.push("", `Total de la semana: ${total} hot-lead${total === 1 ? "" : "s"} registrados.`);
  }
  lineas.push("", "— NICER");
  return lineas.join("\n");
}

async function avisarTelegram(texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto.slice(0, 4000) }),
    });
    return resp.ok;
  } catch (e) {
    console.error("No se pudo enviar el informe de NICER a Telegram:", String(e?.message || e));
    return false;
  }
}

export default async function handler(req, res) {
  // Igual que el briefing: sin CRON_SECRET no se sirve (URL no pública).
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return res.status(500).json({
      error: "El informe no está protegido: define CRON_SECRET en Vercel → Settings → Environment Variables.",
    });
  }
  const porCabecera = req.headers.authorization === `Bearer ${secreto}`;
  const porQuery = req.query && req.query.key === secreto;
  if (!porCabecera && !porQuery) {
    return res.status(401).json({ error: "No autorizado." });
  }

  // Resumen agregado (solo totales, sin datos personales). Si falla, sigue sin él.
  let resumen = null;
  if (nubeConfigurada()) {
    try {
      resumen = await rpc("castebot_leads_resumen", {});
    } catch (e) {
      console.error("No se pudo leer el resumen de castebot_leads:", String(e?.message || e));
    }
  }

  let informe = informeBasico(resumen);

  // Con clave de Anthropic, NICER lo redacta con su voz y sus recomendaciones.
  if (process.env.ANTHROPIC_API_KEY && resumen) {
    try {
      const promptNicer = readFileSync(path.join(process.cwd(), "agentes", "nicer.md"), "utf8");
      const client = new Anthropic();
      const r = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: [
          { type: "text", text: promptNicer, cache_control: { type: "ephemeral" } },
          {
            type: "text",
            text:
              "Tarea de ahora: redacta el informe de las 8:00 para Telegram, en TEXTO PLANO (sin markdown), siguiendo tu formato fijo. Los únicos datos medidos hoy son los hot-leads registrados por agente que te paso — para el resto de métricas de tu formato aún no hay registro: escribe 'sin datos' donde toque, sin inventar nada. Máximo 3 recomendaciones accionables hoy.",
          },
        ],
        messages: [
          {
            role: "user",
            content:
              `Hoy es ${fechaDeHoy()}.\n\nActividad registrada (hot-leads por agente):\n` +
              lineasActividad(resumen).join("\n") +
              `\nTotal 7 días: ${resumen.total_semana || 0}.\n\nEscribe el informe de hoy.`,
          },
        ],
      });
      const texto = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (texto) informe = texto;
    } catch (e) {
      console.error("NICER no pudo redactar el informe (queda el básico):", String(e?.message || e));
    }
  }

  const enviado = await avisarTelegram(informe);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, enviado, informe });
}
