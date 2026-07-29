// ============================================================================
//  Tests de la API de Clara — se ejecutan con: npm test
// ----------------------------------------------------------------------------
//  No llaman a ninguna API real: se simulan las respuestas de Claude, de
//  Perplexity y de asesoriacastresana.com interceptando fetch. Verifican la
//  calculadora, la búsqueda, la cartera, la validación de entradas, los
//  adjuntos multimodales, el flujo completo con herramientas, el streaming
//  SSE y el briefing diario.
// ============================================================================

import handler, { buscarEnPerplexity, calcular } from "../api/clara.js";
import briefing from "../api/briefing.js";
import memoria from "../api/memoria.js";
import { parsearInmuebles, resumenCartera } from "../lib/cartera.js";

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

// HTML de muestra con la estructura real de las tarjetas de asesoriacastresana.com
const HTML_CARTERA = `
<div class="venta" data-url="https://www.asesoriacastresana.com/piso-en-oviedo-centro-es123.html" title="Oviedo" id="1">
<span data-ref="PIS0100"></span>
<a title="Piso en Oviedo centro" href="/piso-en-oviedo-centro-es123.html"><img src="https://apinmo.com/foto/1.jpg"></a>
<h3> Oviedo </h3>
<p class="descripcion ocultar"> Piso luminoso en pleno centro de Oviedo con ascensor y trastero. </p>
<li class="habitaciones"><span>Habitaciones:</span> 3</li>
<li class="banos"><span>Baños:</span> 2</li>
<li class="supConstruida"><span>Sup. Construida:</span> 99 m²</li>
<div class="precio"><p><span class="actual"> 330.000€ </span></p></div>
</div>`;

// ---------------------------------------------------------------------------
console.log("\n— calcular() —");
// ---------------------------------------------------------------------------
check("división simple", calcular("120000/85").endsWith("= 1411.764706"), calcular("120000/85"));
check("rentabilidad bruta (650*12/98000*100)", calcular("650*12/98000*100").endsWith("= 7.959184"), calcular("650*12/98000*100"));
check("porcentaje (120000*(1+8%))", calcular("120000*(1+8%)").endsWith("= 129600"), calcular("120000*(1+8%)"));
check("coma decimal española", calcular("2,5*4").endsWith("= 10"), calcular("2,5*4"));
check("potencia con ^", calcular("2^10").endsWith("= 1024"), calcular("2^10"));
check("rechaza letras/código", calcular("process.exit(1)").startsWith("Expresión no válida"));
check("rechaza expresión vacía", calcular("").startsWith("No se recibió"));
check("división entre cero avisada", calcular("5/0").includes("no dio un número válido"));
check("expresión demasiado larga", calcular("1+".repeat(150) + "1").includes("demasiado larga"));

// ---------------------------------------------------------------------------
console.log("\n— lib/cartera.js —");
// ---------------------------------------------------------------------------
const inmuebles = parsearInmuebles(HTML_CARTERA, "venta");
check("parsea 1 inmueble de la tarjeta", inmuebles.length === 1, JSON.stringify(inmuebles));
const inm = inmuebles[0] || {};
check("referencia comercial", inm.ref === "PIS0100");
check("precio 330.000 €", inm.precio === 330000);
check("superficie 99 m²", inm.m2 === 99);
check("3 habitaciones y 2 baños", inm.habitaciones === 3 && inm.banos === 2);
check("título desde el atributo title", inm.titulo === "Piso en Oviedo centro");
check("URL absoluta", (inm.url || "").startsWith("https://www.asesoriacastresana.com/"));
check("foto detectada", (inm.foto || "").includes("apinmo"));
check("resumen con items", resumenCartera(inmuebles).includes("1 en venta") && resumenCartera(inmuebles).includes("PIS0100"));
check("resumen sin items avisa", resumenCartera([], ["venta: HTTP 500"]).includes("no he podido leer"));

// ---------------------------------------------------------------------------
console.log("\n— buscarEnPerplexity() —");
// ---------------------------------------------------------------------------
delete process.env.PERPLEXITY_API_KEY;
check("sin clave: mensaje claro", (await buscarEnPerplexity("test")).includes("no está configurada"));

process.env.PERPLEXITY_API_KEY = "pplx-test";
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: "El Euríbor está en el 2,1%." } }],
      search_results: [{ title: "Banco de España", url: "https://www.bde.es" }],
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
const busqueda = await buscarEnPerplexity("euríbor hoy");
check("con clave: devuelve respuesta", busqueda.includes("Euríbor"));
check("con clave: cita las fuentes", busqueda.includes("Fuentes:") && busqueda.includes("bde.es"));

globalThis.fetch = async () => new Response("boom", { status: 429 });
check("gestiona el error 429", (await buscarEnPerplexity("x")).includes("429"));
globalThis.fetch = realFetch;

// ---------------------------------------------------------------------------
console.log("\n— handler: validación de entradas —");
// ---------------------------------------------------------------------------
process.env.ANTHROPIC_API_KEY = "sk-ant-test";

let res = mockRes();
await handler({ method: "GET" }, res);
check("GET → 405", res.r.statusCode === 405);

res = mockRes();
await handler({ method: "POST", body: {} }, res);
check("sin messages → 400", res.r.statusCode === 400);

res = mockRes();
await handler({ method: "POST", body: { messages: [{ role: "assistant", content: "hola" }] } }, res);
check("historial que no empieza por user → 400", res.r.statusCode === 400);

// ---------------------------------------------------------------------------
console.log("\n— handler: flujo completo con herramientas (Claude simulado) —");
// ---------------------------------------------------------------------------
const llamadasAnthropic = [];
let ronda = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
  llamadasAnthropic.push(JSON.parse(init.body));
  ronda++;
  const body =
    ronda === 1
      ? {
          id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5",
          content: [
            { type: "tool_use", id: "tu_1", name: "calcular", input: { expresion: "650*12/98000*100" } },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 100, output_tokens: 50 },
        }
      : {
          id: "msg_2", type: "message", role: "assistant", model: "claude-sonnet-5",
          content: [
            { type: "text", text: "La rentabilidad bruta es del 7,96 % (650 € × 12 / 98.000 € × 100)." },
          ],
          stop_reason: "end_turn",
          usage: { input_tokens: 200, output_tokens: 80 },
        };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
};

res = mockRes();
await handler(
  {
    method: "POST",
    body: {
      messages: [{ role: "user", content: "¿Qué rentabilidad da un piso de 98.000 € alquilado a 650 €/mes?" }],
      mode: "inmobiliaria",
      memoria: "Objetivo: invertir en Oviedo este año.",
    },
  },
  res
);

check("respuesta 200", res.r.statusCode === 200, JSON.stringify(res.r.body));
check("devuelve el texto final de Clara", (res.r.body?.reply || "").includes("7,96"));
check("hizo 2 rondas (tool_use → respuesta)", llamadasAnthropic.length === 2);

const sys = llamadasAnthropic[0]?.system || [];
const sysTexto = sys.map((b) => b.text).join("\n---\n");
check("system: persona de Clara presente", sysTexto.includes("Eres CLARA"));
check("system: persona cacheada", sys[0]?.cache_control?.type === "ephemeral");
check("system: fecha de hoy inyectada", sysTexto.includes("Hoy es"));
check("system: memoria de Pau inyectada", sysTexto.includes("invertir en Oviedo"));
check("system: modo inmobiliario activo", sysTexto.includes("NEGOCIO INMOBILIARIO"));
check("declara las 3 herramientas", (llamadasAnthropic[0]?.tools || []).length === 3);
check("mi_cartera declarada", (llamadasAnthropic[0]?.tools || []).some((t) => t.name === "mi_cartera"));

const segundaRonda = llamadasAnthropic[1]?.messages || [];
const toolResult = JSON.stringify(segundaRonda);
check("2ª ronda: incluye el tool_result del cálculo", toolResult.includes("tool_result") && toolResult.includes("7.959184"));

// ---------------------------------------------------------------------------
console.log("\n— handler: adjuntos multimodales —");
// ---------------------------------------------------------------------------
llamadasAnthropic.length = 0;
globalThis.fetch = async (url, init) => {
  llamadasAnthropic.push(JSON.parse(init.body));
  return new Response(
    JSON.stringify({
      id: "msg_4", type: "message", role: "assistant", model: "claude-sonnet-5",
      content: [{ type: "text", text: "Veo un salón luminoso; yo destacaría la luz natural en el anuncio." }],
      stop_reason: "end_turn", usage: { input_tokens: 500, output_tokens: 40 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};
res = mockRes();
await handler(
  {
    method: "POST",
    body: {
      messages: [
        { role: "user", content: "Mira esta foto del salón, ¿qué mejoro?", adjunto: { media_type: "image/jpeg", data: "aGVsbG8=" } },
      ],
    },
  },
  res
);
const msj = llamadasAnthropic[0]?.messages?.[0];
check("adjunto → contenido multimodal (array)", Array.isArray(msj?.content));
check("bloque de imagen con base64 intacto", msj?.content?.[0]?.type === "image" && msj?.content?.[0]?.source?.data === "aGVsbG8=");
check("el texto acompaña a la imagen", msj?.content?.[1]?.type === "text" && msj?.content?.[1]?.text?.includes("salón"));

llamadasAnthropic.length = 0;
res = mockRes();
await handler(
  {
    method: "POST",
    body: { messages: [{ role: "user", content: "hola", adjunto: { media_type: "application/zip", data: "aGVsbG8=" } }] },
  },
  res
);
check("adjunto de tipo no permitido se ignora", typeof llamadasAnthropic[0]?.messages?.[0]?.content === "string");

// ---------------------------------------------------------------------------
console.log("\n— handler: streaming SSE con herramienta mi_cartera —");
// ---------------------------------------------------------------------------
function sseBody(eventos) {
  return eventos.map(([ev, data]) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}
let rondaStream = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("asesoriacastresana.com")) {
    return new Response(HTML_CARTERA, { status: 200, headers: { "content-type": "text/html" } });
  }
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
  rondaStream++;
  const eventos =
    rondaStream === 1
      ? [
          ["message_start", { type: "message_start", message: { id: "msg_5", type: "message", role: "assistant", model: "claude-sonnet-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }],
          ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tu_9", name: "mi_cartera", input: {} } }],
          ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{}" } }],
          ["content_block_stop", { type: "content_block_stop", index: 0 }],
          ["message_delta", { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 5 } }],
          ["message_stop", { type: "message_stop" }],
        ]
      : [
          ["message_start", { type: "message_start", message: { id: "msg_6", type: "message", role: "assistant", model: "claude-sonnet-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }],
          ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
          ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Tienes 1 piso en venta: " } }],
          ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Piso en Oviedo centro (ref PIS0100), 330.000 €." } }],
          ["content_block_stop", { type: "content_block_stop", index: 0 }],
          ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 20 } }],
          ["message_stop", { type: "message_stop" }],
        ];
  return new Response(sseBody(eventos), { status: 200, headers: { "content-type": "text/event-stream" } });
};

res = mockRes();
await handler(
  { method: "POST", body: { stream: true, messages: [{ role: "user", content: "¿Qué pisos tengo ahora mismo?" }], mode: "inmobiliaria" } },
  res
);
const emitido = res.r.chunks.join("");
check("SSE: cabecera event-stream", String(res.r.headers["Content-Type"] || "").includes("text/event-stream"));
check("SSE: emite el estado de mi_cartera", emitido.includes("Leyendo tu cartera"));
check("SSE: llegan los deltas de texto", emitido.includes("Piso en Oviedo centro"));
check("SSE: evento done con la respuesta completa", emitido.includes('"done":true') && emitido.includes("PIS0100"));
check("SSE: hizo 2 rondas de modelo", rondaStream === 2);
check("SSE: la respuesta terminó (end)", res.r.ended === true);

// ---------------------------------------------------------------------------
console.log("\n— handler: rechazo del modelo —");
// ---------------------------------------------------------------------------
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      id: "msg_3", type: "message", role: "assistant", model: "claude-sonnet-5",
      content: [], stop_reason: "refusal", usage: { input_tokens: 10, output_tokens: 0 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
res = mockRes();
await handler({ method: "POST", body: { messages: [{ role: "user", content: "hola" }] } }, res);
check("refusal → respuesta amable, no error", res.r.statusCode === 200 && (res.r.body?.reply || "").includes("Lo siento, Pau"));

// ---------------------------------------------------------------------------
console.log("\n— api/memoria.js (memoria en la nube) —");
// ---------------------------------------------------------------------------
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
res = mockRes();
await memoria({ method: "POST", body: { clave: "x", accion: "lee" } }, res);
check("sin Supabase configurado → 503", res.r.statusCode === 503);

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-test";
const llamadasSupabase = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (!u.includes("test.supabase.co")) throw new Error("fetch inesperado: " + u);
  const fn = u.split("/rpc/")[1];
  const args = JSON.parse(init.body);
  llamadasSupabase.push({ fn, args });
  if (args.clave !== "mi-clave-sync") {
    return new Response(JSON.stringify({ message: "clave de sincronización incorrecta" }), { status: 400 });
  }
  if (fn === "clara_memoria_lee") return new Response(JSON.stringify("- Le encanta Cudillero."), { status: 200 });
  if (fn === "clara_memoria_guarda") return new Response(JSON.stringify(args.nuevo), { status: 200 });
  if (fn === "clara_memoria_apunta") return new Response(JSON.stringify("- Le encanta Cudillero.\n- Objetivo 2026: 20 exclusivas"), { status: 200 });
  return new Response("?", { status: 404 });
};

res = mockRes();
await memoria({ method: "POST", body: { clave: "mi-clave-sync", accion: "lee" } }, res);
check("lee la memoria de la nube", res.r.statusCode === 200 && res.r.body?.contenido === "- Le encanta Cudillero.");

res = mockRes();
await memoria({ method: "POST", body: { clave: "clave-mala", accion: "lee" } }, res);
check("clave incorrecta → 401", res.r.statusCode === 401);

res = mockRes();
await memoria({ method: "POST", body: { clave: "mi-clave-sync", accion: "guarda", contenido: "- Nueva nota" } }, res);
check("guarda en la nube", res.r.statusCode === 200 && res.r.body?.contenido === "- Nueva nota");

res = mockRes();
await memoria({ method: "POST", body: { accion: "lee" } }, res);
check("sin clave → 400", res.r.statusCode === 400);

// ---------------------------------------------------------------------------
console.log("\n— handler: memoria en la nube + herramienta recordar —");
// ---------------------------------------------------------------------------
llamadasSupabase.length = 0;
llamadasAnthropic.length = 0;
let rondaRecordar = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("test.supabase.co")) {
    const fn = u.split("/rpc/")[1];
    const args = JSON.parse(init.body);
    llamadasSupabase.push({ fn, args });
    if (fn === "clara_memoria_lee") return new Response(JSON.stringify("- Le encanta Cudillero."), { status: 200 });
    if (fn === "clara_memoria_apunta") return new Response(JSON.stringify("- Le encanta Cudillero.\n- " + args.nota), { status: 200 });
    return new Response("?", { status: 404 });
  }
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
  llamadasAnthropic.push(JSON.parse(init.body));
  rondaRecordar++;
  const body =
    rondaRecordar === 1
      ? {
          id: "msg_7", type: "message", role: "assistant", model: "claude-sonnet-5",
          content: [{ type: "tool_use", id: "tu_10", name: "recordar", input: { nota: "Objetivo 2026: 20 exclusivas" } }],
          stop_reason: "tool_use", usage: { input_tokens: 100, output_tokens: 30 },
        }
      : {
          id: "msg_8", type: "message", role: "assistant", model: "claude-sonnet-5",
          content: [{ type: "text", text: "Apuntado, Pau: objetivo 2026, 20 exclusivas. 🧠" }],
          stop_reason: "end_turn", usage: { input_tokens: 150, output_tokens: 40 },
        };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
};

res = mockRes();
await handler(
  {
    method: "POST",
    body: {
      messages: [{ role: "user", content: "Recuerda que mi objetivo de 2026 son 20 exclusivas." }],
      clave: "mi-clave-sync",
      memoria: "esto no debería usarse (gana la nube)",
    },
  },
  res
);
const sysNube = (llamadasAnthropic[0]?.system || []).map((b) => b.text).join("\n");
check("respuesta 200 con nube activa", res.r.statusCode === 200, JSON.stringify(res.r.body));
check("la memoria de la nube gana a la local", sysNube.includes("Le encanta Cudillero") && !sysNube.includes("no debería usarse"));
check("el system dice que está sincronizada", sysNube.includes("sincronizada en la nube"));
check("con nube activa hay 4 herramientas (recordar incluida)", (llamadasAnthropic[0]?.tools || []).length === 4 && llamadasAnthropic[0].tools.some((t) => t.name === "recordar"));
check("recordar apuntó la nota en Supabase", llamadasSupabase.some((c) => c.fn === "clara_memoria_apunta" && c.args.nota === "Objetivo 2026: 20 exclusivas"));
check("el tool_result confirma el guardado", JSON.stringify(llamadasAnthropic[1]?.messages || []).includes("Nota guardada"));
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
console.log("\n— api/briefing.js —");
// ---------------------------------------------------------------------------
process.env.CRON_SECRET = "top-secreto";
res = mockRes();
await briefing({ method: "GET", headers: {} }, res);
check("con CRON_SECRET y sin cabecera → 401", res.r.statusCode === 401);
delete process.env.CRON_SECRET;

const claveAnthropic = process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_API_KEY; // así el briefing usa el modo básico, sin IA
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes("asesoriacastresana.com")) {
    return new Response(HTML_CARTERA, { status: 200, headers: { "content-type": "text/html" } });
  }
  throw new Error("fetch inesperado: " + u);
};
res = mockRes();
await briefing({ method: "GET", headers: {} }, res);
check("briefing → 200", res.r.statusCode === 200);
check("briefing básico con la cartera real", (res.r.body?.briefing || "").includes("Briefing de Clara") && (res.r.body?.briefing || "").includes("2 inmuebles (1 en venta, 1 en alquiler)"), res.r.body?.briefing);
check("sin Telegram configurado, enviado=false", res.r.body?.enviado === false);
process.env.ANTHROPIC_API_KEY = claveAnthropic;

globalThis.fetch = realFetch;

// ---------------------------------------------------------------------------
console.log(`\nResultado: ${pasados} pasados, ${fallados} fallados.\n`);
process.exit(fallados === 0 ? 0 : 1);
