// ============================================================================
//  Tests de la API de CasteBot (red de 6 agentes) — npm test los ejecuta
// ----------------------------------------------------------------------------
//  No llaman a ninguna API real: se simulan las respuestas de Claude y de
//  Telegram interceptando fetch. Verifican la validación de entradas, la
//  composición del system prompt (reglas comunes + prompt del agente), el
//  bloque [[HOTLEAD]] (extracción, aviso a Telegram y ocultación al cliente)
//  y el streaming SSE con retención del marcador.
// ============================================================================

import handler, { separarHotlead } from "../api/castebot.js";
import informe from "../api/castebot-informe.js";

let pasados = 0;
let fallados = 0;
function check(nombre, condicion, detalle = "") {
  if (condicion) {
    pasados++;
    console.log(`  ✅ ${nombre}`);
  } else {
    fallados++;
    console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`);
  }
}

function mockRes() {
  const r = { statusCode: 0, body: null, headers: {}, chunks: [], ended: false };
  return {
    status(c) { r.statusCode = c; return this; },
    json(b) { r.body = b; return this; },
    setHeader(k, v) { r.headers[k] = v; },
    writeHead(c, h) { r.statusCode = c; Object.assign(r.headers, h || {}); },
    write(s) { r.chunks.push(String(s)); return true; },
    end() { r.ended = true; },
    r,
  };
}

const realFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
console.log("\n— separarHotlead() —");
// ---------------------------------------------------------------------------
let sep = separarHotlead("Hola, te agendo la visita.\n\n[[HOTLEAD]]\n🔥 HOT-LEAD JUANJO\nNombre: María\n[[/HOTLEAD]]");
check("extrae el bloque hot-lead", (sep.hotlead || "").includes("María"));
check("el cliente no ve el bloque", sep.visible === "Hola, te agendo la visita." && !sep.visible.includes("HOTLEAD"));
sep = separarHotlead("Respuesta normal sin lead.");
check("sin bloque → hotlead null", sep.hotlead === null && sep.visible === "Respuesta normal sin lead.");
sep = separarHotlead("Texto…\n[[HOTLEAD]]\n🔥 HOT-LEAD JAVI\nNombre: Pepe");
check("bloque sin cerrar también se extrae", (sep.hotlead || "").includes("Pepe") && !sep.visible.includes("Pepe"));

// ---------------------------------------------------------------------------
console.log("\n— handler: validación de entradas —");
// ---------------------------------------------------------------------------
process.env.ANTHROPIC_API_KEY = "sk-ant-test";

let res = mockRes();
await handler({ method: "GET" }, res);
check("GET → 405", res.r.statusCode === 405);

delete process.env.ANTHROPIC_API_KEY;
res = mockRes();
await handler({ method: "POST", body: { agente: "juanjo", messages: [{ role: "user", content: "hola" }] } }, res);
check("sin ANTHROPIC_API_KEY → 500", res.r.statusCode === 500);
process.env.ANTHROPIC_API_KEY = "sk-ant-test";

res = mockRes();
await handler({ method: "POST", body: { agente: "../etc/passwd", messages: [{ role: "user", content: "hola" }] } }, res);
check("agente no válido → 400", res.r.statusCode === 400);

res = mockRes();
await handler({ method: "POST", body: { agente: "juanjo" } }, res);
check("sin messages → 400", res.r.statusCode === 400);

res = mockRes();
await handler({ method: "POST", body: { agente: "juanjo", messages: [{ role: "assistant", content: "hola" }] } }, res);
check("historial que no empieza por user → 400", res.r.statusCode === 400);

// ---------------------------------------------------------------------------
console.log("\n— handler: flujo clásico con hot-lead (Claude y Telegram simulados) —");
// ---------------------------------------------------------------------------
process.env.TELEGRAM_BOT_TOKEN = "123:test";
process.env.TELEGRAM_CHAT_ID = "-100999";

const llamadasAnthropic = [];
const llamadasTelegram = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.telegram.org")) {
    llamadasTelegram.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
  llamadasAnthropic.push(JSON.parse(init.body));
  return new Response(
    JSON.stringify({
      id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5",
      content: [
        {
          type: "text",
          text:
            "¡Genial, Marta! Tu expediente está completo; el equipo te llama mañana.\n\n" +
            "[[HOTLEAD]]\n🔥 HOT-LEAD NURIA\nNombre: Marta\nTeléfono/canal: 600 111 222\nQué quiere: alquilar en Oviedo\nDato clave: expediente completo\nSiguiente paso propuesto: llamada del despacho\n[[/HOTLEAD]]",
        },
      ],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 60 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};

res = mockRes();
await handler(
  { method: "POST", body: { agente: "nuria", messages: [{ role: "user", content: "Ya os mandé la última nómina" }] } },
  res
);
check("respuesta 200", res.r.statusCode === 200, JSON.stringify(res.r.body));
check("el cliente recibe el mensaje sin el bloque", (res.r.body?.reply || "").includes("Marta") && !(res.r.body?.reply || "").includes("HOTLEAD"));
check("el hot-lead llegó a Telegram", llamadasTelegram.length === 1 && llamadasTelegram[0].text.includes("🔥 HOT-LEAD NURIA"));
check("Telegram usa el chat del despacho", llamadasTelegram[0]?.chat_id === "-100999");

const sys = llamadasAnthropic[0]?.system || [];
const sysTexto = sys.map((b) => b.text).join("\n---\n");
check("system: reglas comunes presentes", sysTexto.includes("Asesoría Castresana") && sysTexto.includes("desde 1993"));
check("system: prompt de NURIA presente", sysTexto.includes("Eres **NURIA**"));
check("system: mecánica [[HOTLEAD]] explicada", sysTexto.includes("[[HOTLEAD]]"));
check("system: fecha de hoy inyectada", sysTexto.includes("Hoy es"));
check("system: prompts cacheados", sys[0]?.cache_control?.type === "ephemeral");
check("modelo y límite de tokens correctos", llamadasAnthropic[0]?.model === "claude-sonnet-5" && llamadasAnthropic[0]?.max_tokens === 1500);

// El alias "pau" carga el prompt de pau-bot.md
llamadasAnthropic.length = 0;
res = mockRes();
await handler({ method: "POST", body: { agente: "PAU", messages: [{ role: "user", content: "hola" }] } }, res);
const sysPau = (llamadasAnthropic[0]?.system || []).map((b) => b.text).join("\n");
check("agente 'pau' (mayúsculas) carga pau-bot.md", sysPau.includes("Eres **PAU**"));

// ---------------------------------------------------------------------------
console.log("\n— handler: streaming SSE con marcador hot-lead partido —");
// ---------------------------------------------------------------------------
function sseBody(eventos) {
  return eventos.map(([ev, data]) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

llamadasTelegram.length = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.telegram.org")) {
    llamadasTelegram.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
  const eventos = [
    ["message_start", { type: "message_start", message: { id: "msg_2", type: "message", role: "assistant", model: "claude-sonnet-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Perfecto, te agendo la visita del piso de La Corredoria. " } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "¡Hasta el jueves!\n\n[[HOT" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "LEAD]]\n🔥 HOT-LEAD JUANJO\nNombre: Luis\n[[/HOTLEAD]]" } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 30 } }],
    ["message_stop", { type: "message_stop" }],
  ];
  return new Response(sseBody(eventos), { status: 200, headers: { "content-type": "text/event-stream" } });
};

res = mockRes();
await handler(
  { method: "POST", body: { agente: "juanjo", stream: true, messages: [{ role: "user", content: "El jueves me viene bien" }] } },
  res
);
const emitido = res.r.chunks.join("");
check("SSE: cabecera event-stream", String(res.r.headers["Content-Type"] || "").includes("text/event-stream"));
check("SSE: llegan los deltas de texto", emitido.includes("La Corredoria"));
const eventosEmitidos = emitido.split("\n\n").filter(Boolean).map((l) => { try { return JSON.parse(l.replace(/^data: /, "")); } catch { return {}; } });
const textoStreameado = eventosEmitidos.filter((e) => e.t).map((e) => e.t).join("");
check("SSE: el texto streameado no contiene el bloque", !textoStreameado.includes("HOTLEAD") && !textoStreameado.includes("Luis"));
const doneEv = eventosEmitidos.find((e) => e.done);
check("SSE: reply final limpio y completo", (doneEv?.reply || "").includes("jueves") && !(doneEv?.reply || "").includes("HOTLEAD"));
check("SSE: el hot-lead llegó a Telegram", llamadasTelegram.length === 1 && llamadasTelegram[0].text.includes("Luis"));
check("SSE: la respuesta terminó (end)", res.r.ended === true);

// ---------------------------------------------------------------------------
console.log("\n— handler: sin Telegram configurado no rompe —");
// ---------------------------------------------------------------------------
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.telegram.org")) throw new Error("no debería llamar a Telegram sin configurar");
  return new Response(
    JSON.stringify({
      id: "msg_3", type: "message", role: "assistant", model: "claude-sonnet-5",
      content: [{ type: "text", text: "Anotado.\n[[HOTLEAD]]\n🔥 HOT-LEAD JAVI\nNombre: Ana\n[[/HOTLEAD]]" }],
      stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
res = mockRes();
await handler({ method: "POST", body: { agente: "javi", messages: [{ role: "user", content: "hola" }] } }, res);
check("sin Telegram: responde 200 igualmente", res.r.statusCode === 200 && (res.r.body?.reply || "") === "Anotado.");

// ---------------------------------------------------------------------------
console.log("\n— handler: registro del hot-lead en Supabase —");
// ---------------------------------------------------------------------------
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-test";
process.env.TELEGRAM_BOT_TOKEN = "123:test";
process.env.TELEGRAM_CHAT_ID = "-100999";
const altasSupabase = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("test.supabase.co/rest/v1/rpc/castebot_lead_guarda")) {
    altasSupabase.push(JSON.parse(init.body));
    return new Response("", { status: 200 });
  }
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
  return new Response(
    JSON.stringify({
      id: "msg_5", type: "message", role: "assistant", model: "claude-sonnet-5",
      content: [{ type: "text", text: "Te llaman hoy.\n[[HOTLEAD]]\n🔥 HOT-LEAD JUANJO\nNombre: Carlos\n[[/HOTLEAD]]" }],
      stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 10 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
res = mockRes();
await handler({ method: "POST", body: { agente: "juanjo", messages: [{ role: "user", content: "hola" }] } }, res);
check("hot-lead registrado en Supabase (RPC castebot_lead_guarda)", altasSupabase.length === 1, JSON.stringify(altasSupabase));
check("registro con agente y resumen", altasSupabase[0]?.agente_nuevo === "JUANJO" && (altasSupabase[0]?.resumen_nuevo || "").includes("Carlos"));
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;

// ---------------------------------------------------------------------------
console.log("\n— api/castebot-informe.js (informe diario de NICER) —");
// ---------------------------------------------------------------------------
delete process.env.CRON_SECRET;
res = mockRes();
await informe({ method: "GET", headers: {}, query: {} }, res);
check("sin CRON_SECRET → 500", res.r.statusCode === 500);

process.env.CRON_SECRET = "secreto-cron";
res = mockRes();
await informe({ method: "GET", headers: {}, query: { key: "mala" } }, res);
check("clave incorrecta → 401", res.r.statusCode === 401);

// Sin nube ni IA: informe básico avisando de que no hay datos.
delete process.env.ANTHROPIC_API_KEY;
res = mockRes();
await informe({ method: "GET", headers: {}, query: { key: "secreto-cron" } }, res);
check("sin nube: informe básico con aviso", res.r.statusCode === 200 && (res.r.body?.informe || "").includes("Sin datos"));

// Con nube simulada y Telegram: totales por agente y envío.
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-test";
process.env.TELEGRAM_BOT_TOKEN = "123:test";
process.env.TELEGRAM_CHAT_ID = "-100999";
const telegramsInforme = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("test.supabase.co/rest/v1/rpc/castebot_leads_resumen")) {
    return new Response(
      JSON.stringify({ hoy: [{ agente: "NURIA", total: 2 }], semana: [{ agente: "NURIA", total: 5 }, { agente: "JAVI", total: 1 }], total_semana: 6, ultimo: "2026-08-25T08:00:00Z" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }
  if (u.includes("api.telegram.org")) {
    telegramsInforme.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new Error("fetch inesperado: " + u);
};
res = mockRes();
await informe({ method: "GET", headers: { authorization: "Bearer secreto-cron" }, query: {} }, res);
check("informe básico con totales por agente", res.r.statusCode === 200 && (res.r.body?.informe || "").includes("NURIA: 2 hot-leads"));
check("el informe llegó a Telegram", telegramsInforme.length === 1 && res.r.body?.enviado === true);

// Con IA simulada: NICER redacta el informe con su voz.
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
const sistemasInforme = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("test.supabase.co/rest/v1/rpc/castebot_leads_resumen")) {
    return new Response(JSON.stringify({ hoy: [], semana: [], total_semana: 0, ultimo: null }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("api.telegram.org")) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
  sistemasInforme.push(JSON.parse(init.body));
  return new Response(
    JSON.stringify({
      id: "msg_6", type: "message", role: "assistant", model: "claude-sonnet-5",
      content: [{ type: "text", text: "📊 CASTRESANA — hoy\nJUANJO: sin datos\n✅ Hoy recomiendo: 1) activar captación" }],
      stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 50 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
res = mockRes();
await informe({ method: "GET", headers: { authorization: "Bearer secreto-cron" }, query: {} }, res);
check("con IA: NICER redacta el informe", (res.r.body?.informe || "").includes("Hoy recomiendo"));
const sysInforme = (sistemasInforme[0]?.system || []).map((b) => b.text).join("\n");
check("con IA: usa el prompt maestro de NICER", sysInforme.includes("Eres **NICER**"));
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
delete process.env.CRON_SECRET;

// ---------------------------------------------------------------------------
console.log("\n— handler: rechazo del modelo —");
// ---------------------------------------------------------------------------
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      id: "msg_4", type: "message", role: "assistant", model: "claude-sonnet-5",
      content: [], stop_reason: "refusal", usage: { input_tokens: 10, output_tokens: 0 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
res = mockRes();
await handler({ method: "POST", body: { agente: "alejandro", messages: [{ role: "user", content: "hola" }] } }, res);
check("refusal → respuesta amable, no error", res.r.statusCode === 200 && (res.r.body?.reply || "").includes("no puedo atenderlo"));

globalThis.fetch = realFetch;

console.log(`\nResultado CasteBot: ${pasados} pasados, ${fallados} fallados.\n`);
if (fallados > 0) process.exit(1);
