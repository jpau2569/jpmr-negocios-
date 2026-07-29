// ============================================================================
//  Briefing diario de Clara — proactividad
// ----------------------------------------------------------------------------
//  Un cron de Vercel (ver vercel.json) llama a esta función cada mañana.
//  1. Lee la cartera real de Asesoría Castresana (lib/cartera.js).
//  2. Si hay ANTHROPIC_API_KEY, Clara redacta un briefing corto con su voz.
//  3. Si hay TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, lo envía al Telegram de Pau.
//     Si no, la respuesta JSON devuelve el briefing (se puede abrir la URL a mano).
//
//  Variables de entorno opcionales:
//   - CRON_SECRET: si existe, solo acepta llamadas con "Authorization: Bearer <secreto>"
//     (Vercel Cron la envía automáticamente cuando está definida).
//   - TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID: para recibirlo en el móvil.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { obtenerCartera, resumenCartera } from "../lib/cartera.js";

function fechaDeHoy() {
  try {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeZone: "Europe/Madrid" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// Briefing de respaldo, sin IA: datos puros de la cartera.
function briefingBasico(items, errores) {
  const venta = items.filter((i) => i.operacion === "venta");
  const alquiler = items.filter((i) => i.operacion === "alquiler");
  const conPrecio = venta.filter((i) => i.precio);
  const lineas = [
    `📋 Briefing de Clara — ${fechaDeHoy()}`,
    "",
    `🏠 Cartera publicada: ${items.length} inmuebles (${venta.length} en venta, ${alquiler.length} en alquiler).`,
  ];
  if (conPrecio.length) {
    const max = conPrecio.reduce((a, b) => (a.precio > b.precio ? a : b));
    const min = conPrecio.reduce((a, b) => (a.precio < b.precio ? a : b));
    lineas.push(`💶 En venta: desde ${min.precio.toLocaleString("es-ES")} € (${min.titulo}) hasta ${max.precio.toLocaleString("es-ES")} € (${max.titulo}).`);
  }
  if (errores.length) lineas.push(`⚠️ Avisos al leer la web: ${errores.join("; ")}.`);
  lineas.push("", "¡A por el día, Pau! 💜 — Clara");
  return lineas.join("\n");
}

export default async function handler(req, res) {
  // Vercel Cron envía "Authorization: Bearer CRON_SECRET" si la variable existe.
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const { items, errores } = await obtenerCartera();
  let briefing = briefingBasico(items, errores);

  // Con clave de Anthropic, Clara redacta el briefing con su voz (si falla, queda el básico).
  if (process.env.ANTHROPIC_API_KEY && items.length) {
    try {
      const client = new Anthropic();
      const r = await client.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1200,
        system:
          "Eres CLARA, la asistente personal de Pau Moralejo (Asesoría Castresana, Oviedo). Redactas su briefing inmobiliario de la mañana en español de España: cálido, directo, sin inventar nada y en 10-14 líneas como máximo. Estructura: saludo de una línea · foto de la cartera (totales y rangos de precio) · 2-3 inmuebles a destacar hoy con su referencia y por qué (precio llamativo, oportunidad de contenido para redes, piso que conviene mover) · un siguiente paso concreto para hoy. Solo texto plano con emojis sobrios, sin markdown.",
        messages: [
          {
            role: "user",
            content: `Hoy es ${fechaDeHoy()}. Datos reales de la cartera leídos ahora mismo:\n\n${resumenCartera(items, errores)}\n\nEscribe mi briefing de hoy.`,
          },
        ],
      });
      const texto = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      if (texto) briefing = `📋 Briefing de Clara — ${fechaDeHoy()}\n\n${texto}`;
    } catch (e) {
      console.error("Briefing: fallo al redactar con Claude:", e?.message || e);
    }
  }

  // Envío a Telegram si está configurado.
  let enviado = false;
  let errorEnvio;
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: briefing.slice(0, 4000) }),
      });
      enviado = r.ok;
      if (!r.ok) errorEnvio = `Telegram HTTP ${r.status}`;
    } catch (e) {
      errorEnvio = String(e?.message || e);
    }
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    enviado,
    errorEnvio,
    inmuebles: items.length,
    briefing,
  });
}
