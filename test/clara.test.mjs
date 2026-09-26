// ============================================================================
//  Tests de la API de Clara — se ejecutan con: npm test
// ----------------------------------------------------------------------------
//  No llaman a ninguna API real: se simulan las respuestas de Claude, de
//  Gemini y de asesoriacastresana.com interceptando fetch. Verifican la
//  calculadora, la búsqueda, la cartera, la validación de entradas, los
//  adjuntos multimodales, el flujo completo con herramientas, el streaming
//  SSE y el briefing diario.
// ============================================================================

import handler, { buscarConGemini, calcular, resumenLeads } from "../api/_clara.js";
import { leerWeb, esIpPrivada, htmlATexto } from "../lib/leerweb.js";
import briefing from "../api/_briefing.js";
import memoria from "../api/_memoria.js";
import lead from "../api/_lead.js";
import leads from "../api/_leads.js";
import { parsearInmuebles, resumenCartera } from "../lib/cartera.js";
import { SKILLS_BASE, catalogoSkills, leerSkill, guardarSkill, parsearSkillMd, skillsDeArchivo } from "../lib/skills.js";
import { leerConectores, piezasMcp, textoConectores, secretoPuente } from "../lib/conectores.js";
import { consultarModelo } from "../lib/openrouter.js";
import puente from "../api/_mcp-puente.js";

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
console.log("\n— buscarConGemini() —");
// ---------------------------------------------------------------------------
delete process.env.GEMINI_API_KEY;
check("sin clave: mensaje claro", (await buscarConGemini("test")).includes("no está configurada"));

process.env.GEMINI_API_KEY = "clave-gemini-test";
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: "El Euríbor está en el 2,1%." }] },
          groundingMetadata: {
            groundingChunks: [
              { web: { title: "Banco de España", uri: "https://www.bde.es" } },
              { web: { title: "Banco de España", uri: "https://www.bde.es" } },
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
const busqueda = await buscarConGemini("euríbor hoy");
check("con clave: devuelve respuesta", busqueda.includes("Euríbor"));
check("con clave: cita las fuentes sin duplicar", busqueda.includes("Fuentes:") && busqueda.includes("bde.es") && !busqueda.includes("[2]"));

globalThis.fetch = async () => new Response("boom", { status: 429 });
check("gestiona el error 429", (await buscarConGemini("x")).includes("429"));
globalThis.fetch = async () => new Response("API key not valid", { status: 400 });
check("clave inválida → mensaje de clave", (await buscarConGemini("x")).includes("GEMINI_API_KEY"));
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
check("declara las 6 herramientas base (preparar_valoracion incluida)", (llamadasAnthropic[0]?.tools || []).length === 6 && (llamadasAnthropic[0]?.tools || []).some((t) => t.name === "preparar_valoracion"));
check("mi_cartera, usar_skill y leer_web declaradas", ["mi_cartera", "usar_skill", "leer_web"].every((n) => (llamadasAnthropic[0]?.tools || []).some((t) => t.name === n)));

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

llamadasAnthropic.length = 0;
res = mockRes();
const variasFotos = Array.from({ length: 8 }, () => ({ media_type: "image/jpeg", data: "aGVsbG8=" }));
variasFotos[1] = { media_type: "image/jpeg", data: "no es base64 <script>" };
await handler(
  { method: "POST", body: { messages: [{ role: "user", content: "📲 Compartido desde WhatsApp (8 archivos):", adjuntos: [...variasFotos, { media_type: "application/pdf", data: "aGVsbG8=" }] }] } },
  res
);
const multi = llamadasAnthropic[0]?.messages?.[0]?.content || [];
check("varias fotos (adjuntos) → varios bloques de imagen, máximo 6 y sin los inválidos", Array.isArray(multi) && multi.filter((b) => b.type === "image").length === 5 && multi.at(-1)?.type === "text", JSON.stringify(multi.map((b) => b.type)));

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
check("con nube activa hay 9 herramientas (recordar, crear_skill y mis_leads incluidas)", (llamadasAnthropic[0]?.tools || []).length === 9 && ["recordar", "crear_skill", "mis_leads"].every((n) => llamadasAnthropic[0].tools.some((t) => t.name === n)));
check("recordar apuntó la nota en Supabase", llamadasSupabase.some((c) => c.fn === "clara_memoria_apunta" && c.args.nota === "Objetivo 2026: 20 exclusivas"));
check("el tool_result confirma el guardado", JSON.stringify(llamadasAnthropic[1]?.messages || []).includes("Nota guardada"));
// ---------------------------------------------------------------------------
console.log("\n— lib/skills.js + herramientas usar_skill / crear_skill —");
// ---------------------------------------------------------------------------
check("hay 4 skills base", Object.keys(SKILLS_BASE).length === 4);
check("skill de ebooks con método Higgsfield", (await leerSkill("", "ebook-lead-magnet")).includes("Higgsfield"));
check("skill de apps móviles (PWA primero)", (await leerSkill("", "app-movil-profesional")).includes("PWA"));
check("skill de webs 3D (Three.js)", (await leerSkill("", "web-3d-profesional")).includes("Three.js"));
const catSinNube = await catalogoSkills("");
check("catálogo sin nube: base + SKILL.md", catSinNube.filter((x) => x.origen === "base").length === 4 && catSinNube.some((x) => x.origen === "SKILL.md" && x.nombre === "ficha-portal-inmobiliario"));
check("toda carpeta de skills/ tiene un SKILL.md válido con su mismo nombre", (await import("node:fs")).readdirSync("skills", { withFileTypes: true }).filter((d) => d.isDirectory()).every((d) => skillsDeArchivo()[d.name]));
check("lee una skill SKILL.md", (await leerSkill("", "mensajes-clientes")).includes("WhatsApp"));
check("parsearSkillMd lee name y description", parsearSkillMd("---\nname: prueba-uno\ndescription: \"Sirve para X\"\n---\n# Hola").descripcion === "Sirve para X");
check("parsearSkillMd rechaza sin cabecera o nombre malo", parsearSkillMd("# sin cabecera") === null && parsearSkillMd("---\nname: Mal Nombre\ndescription: x\n---\nz") === null);
let chocoArchivo = "";
try { await guardarSkill("mi-clave-sync", "mensajes-clientes", "x", "y"); } catch (e) { chocoArchivo = e.message; }
check("no deja sobrescribir una skill SKILL.md", chocoArchivo.includes("carpeta skills/"));
let choco = "";
try { await guardarSkill("mi-clave-sync", "ebook-lead-magnet", "x", "y".repeat(60)); } catch (e) { choco = e.message; }
check("no deja sobrescribir una skill base", choco.includes("no se puede sobrescribir"));

// Flujo completo: Clara consulta el catálogo y crea una skill nueva.
llamadasSupabase.length = 0;
llamadasAnthropic.length = 0;
let rondaSkills = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("test.supabase.co")) {
    const fn = u.split("/rpc/")[1];
    const args = JSON.parse(init.body);
    llamadasSupabase.push({ fn, args });
    if (fn === "clara_memoria_lee") return new Response(JSON.stringify(""), { status: 200 });
    if (fn === "clara_skills_lista") return new Response(JSON.stringify([{ nombre: "email-visitas", descripcion: "Emails tras visita" }]), { status: 200 });
    if (fn === "clara_skills_guarda") return new Response("", { status: 200 });
    return new Response("?", { status: 404 });
  }
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
  llamadasAnthropic.push(JSON.parse(init.body));
  rondaSkills++;
  const body =
    rondaSkills === 1
      ? {
          id: "msg_9", type: "message", role: "assistant", model: "claude-sonnet-5",
          content: [{ type: "tool_use", id: "tu_11", name: "usar_skill", input: {} }],
          stop_reason: "tool_use", usage: { input_tokens: 100, output_tokens: 20 },
        }
      : rondaSkills === 2
        ? {
            id: "msg_10", type: "message", role: "assistant", model: "claude-sonnet-5",
            content: [{ type: "tool_use", id: "tu_12", name: "crear_skill", input: { nombre: "guiones-visita", descripcion: "Guiones de visita a inmuebles", contenido: "## Cuándo usarla\nCuando Pau prepare una visita.\n## Método\n1. Saludo...\n## Entrega estándar\nGuion completo.\n## Norma\nSin promesas falsas." } }],
            stop_reason: "tool_use", usage: { input_tokens: 150, output_tokens: 40 },
          }
        : {
            id: "msg_11", type: "message", role: "assistant", model: "claude-sonnet-5",
            content: [{ type: "text", text: "Skill creada y aplicada, Pau. 🛠️" }],
            stop_reason: "end_turn", usage: { input_tokens: 200, output_tokens: 30 },
          };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
};

res = mockRes();
await handler(
  {
    method: "POST",
    body: {
      messages: [{ role: "user", content: "Crea una skill para guiones de visita y úsala." }],
      clave: "mi-clave-sync",
    },
  },
  res
);
check("flujo de skills → 200", res.r.statusCode === 200, JSON.stringify(res.r.body));
const catalogoDevuelto = JSON.stringify(llamadasAnthropic[1]?.messages || []);
check("el catálogo mezcla base + personalizadas", catalogoDevuelto.includes("ebook-lead-magnet") && catalogoDevuelto.includes("email-visitas"));
check("crear_skill guardó en Supabase", llamadasSupabase.some((c) => c.fn === "clara_skills_guarda" && c.args.skill === "guiones-visita"));
const confirmacion = JSON.stringify(llamadasAnthropic[2]?.messages || []);
check("el tool_result confirma la skill creada", confirmacion.includes("guiones-visita") && confirmacion.includes("guardada"));
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
console.log("\n— api/briefing.js —");
// ---------------------------------------------------------------------------
process.env.CRON_SECRET = "top-secreto";
res = mockRes();
await briefing({ method: "GET", headers: {} }, res);
check("con CRON_SECRET y sin cabecera → 401", res.r.statusCode === 401);

// Sin CRON_SECRET configurado, el briefing NO se sirve (evita URL pública).
delete process.env.CRON_SECRET;
res = mockRes();
await briefing({ method: "GET", headers: {} }, res);
check("sin CRON_SECRET configurado → 500", res.r.statusCode === 500);
process.env.CRON_SECRET = "top-secreto";

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
await briefing({ method: "GET", headers: { authorization: "Bearer top-secreto" } }, res);
check("briefing autorizado por cabecera → 200", res.r.statusCode === 200);
check("briefing básico con la cartera real", (res.r.body?.briefing || "").includes("Briefing de Clara") && (res.r.body?.briefing || "").includes("2 inmuebles (1 en venta, 1 en alquiler)"), res.r.body?.briefing);
check("sin Telegram configurado, enviado=false", res.r.body?.enviado === false);

res = mockRes();
await briefing({ method: "GET", headers: {}, query: { key: "top-secreto" } }, res);
check("briefing autorizado por ?key= → 200", res.r.statusCode === 200);

process.env.ANTHROPIC_API_KEY = claveAnthropic;
delete process.env.CRON_SECRET;

globalThis.fetch = realFetch;

// ---------------------------------------------------------------------------
console.log("\n— api/lead.js (landing del ebook) —");
// ---------------------------------------------------------------------------
res = mockRes();
await lead({ method: "GET" }, res);
check("GET → 405", res.r.statusCode === 405);

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
res = mockRes();
await lead({ method: "POST", body: { email: "pau@test.com" } }, res);
check("sin Supabase → 503", res.r.statusCode === 503);

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-test";
const altasLead = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (!u.includes("test.supabase.co/rest/v1/rpc/lead_guarda")) throw new Error("fetch inesperado: " + u);
  altasLead.push(JSON.parse(init.body));
  return new Response("", { status: 200 });
};

res = mockRes();
await lead({ method: "POST", body: { email: "esto-no-es-un-email" } }, res);
check("email inválido → 400", res.r.statusCode === 400);

res = mockRes();
await lead({ method: "POST", body: { origen: "ebook-7-errores", nombre: "Pau", email: "pau@test.com", telefono: "600", tipo: "inversor" } }, res);
check("alta de lead → 200", res.r.statusCode === 200 && res.r.body?.ok === true);
check("el lead llegó a Supabase con sus datos", altasLead.some((a) => a.email_nuevo === "pau@test.com" && a.tipo_nuevo === "inversor" && a.origen_nuevo === "ebook-7-errores"));
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
globalThis.fetch = realFetch;

// ---------------------------------------------------------------------------
console.log("\n— api/leads.js (panel de leads) —");
// ---------------------------------------------------------------------------
res = mockRes();
await leads({ method: "GET" }, res);
check("GET → 405", res.r.statusCode === 405);

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
res = mockRes();
await leads({ method: "POST", body: { clave: "x" } }, res);
check("sin Supabase → 503", res.r.statusCode === 503);

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "anon-test";
res = mockRes();
await leads({ method: "POST", body: {} }, res);
check("sin clave → 400", res.r.statusCode === 400);

const LEADS_FALSOS = [
  { id: 1, created_at: "2026-08-01T09:30:00Z", nombre: "Ana", email: "ana@test.com", origen: "ebook-7-errores", tipo: "propietario" },
  { id: 2, created_at: "2026-08-02T10:00:00Z", nombre: "Luis", email: "luis@test.com", origen: "ebook-7-errores", tipo: "inversor" },
];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (!u.includes("test.supabase.co/rest/v1/rpc/leads_lista")) throw new Error("fetch inesperado: " + u);
  const { clave } = JSON.parse(init.body);
  if (clave !== "buena") return new Response("clave incorrecta", { status: 401 });
  return new Response(JSON.stringify(LEADS_FALSOS), { status: 200, headers: { "content-type": "application/json" } });
};

res = mockRes();
await leads({ method: "POST", body: { clave: "mala" } }, res);
check("clave incorrecta → 401", res.r.statusCode === 401);

res = mockRes();
await leads({ method: "POST", body: { clave: "buena" } }, res);
check("clave correcta → 200 con la lista", res.r.statusCode === 200 && res.r.body?.total === 2 && res.r.body?.leads?.[0]?.email === "ana@test.com");

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
globalThis.fetch = realFetch;

// ---------------------------------------------------------------------------
console.log("\n— leer_web (lector de enlaces) —");
check("bloquea loopback y redes privadas", ["127.0.0.1", "10.1.2.3", "192.168.1.10", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"].every(esIpPrivada));
check("permite IPs públicas", !esIpPrivada("93.184.216.34") && !esIpPrivada("2606:2800:220:1::1"));
const pagina = htmlATexto("<html><head><title>Piso en Oviedo &amp; garaje</title><style>x{}</style></head><body><nav>menú</nav><h1>Piso 3 hab</h1><p>Precio: 120.000&nbsp;&euro;</p><script>alert(1)</script></body></html>");
check("htmlATexto saca título y texto sin scripts ni menús", pagina.titulo === "Piso en Oviedo & garaje" && pagina.texto.includes("Piso 3 hab") && pagina.texto.includes("120.000 €") && !pagina.texto.includes("alert") && !pagina.texto.includes("menú"), JSON.stringify(pagina));

const resolverPublico = async () => [{ address: "93.184.216.34" }];
let pedidas = 0;
globalThis.fetch = async () => { pedidas++; return new Response("x"); };
check("rechaza localhost sin llamar a la red", (await leerWeb("http://localhost/admin", { resolver: resolverPublico })).includes("internas") && pedidas === 0);
check("rechaza IP de metadatos de la nube", (await leerWeb("http://169.254.169.254/latest", { resolver: resolverPublico })).includes("internas") && pedidas === 0);
check("rechaza dominio que resuelve a IP privada", (await leerWeb("https://trampa.example.com", { resolver: async () => [{ address: "10.0.0.5" }] })).includes("privadas") && pedidas === 0);
check("rechaza protocolos no web", (await leerWeb("file:///etc/passwd", { resolver: resolverPublico })).includes("http") && pedidas === 0);
check("enlace no válido avisado", (await leerWeb("no es un enlace")).includes("no es válido"));

// IPv6 que llevan dentro una IPv4 privada (hallazgo de NICER): antes pasaban.
const IPV6_CON_IPV4_PRIVADA = [
  "::ffff:7f00:1",              // ::ffff:127.0.0.1 tal como lo deja new URL()
  "::ffff:127.0.0.1",
  "::FFFF:127.0.0.1",
  "0:0:0:0:0:ffff:7f00:1",
  "::ffff:a9fe:a9fe",           // 169.254.169.254 (metadatos de la nube)
  "::ffff:169.254.169.254",
  "::ffff:a00:5",               // 10.0.0.5
  "::ffff:c0a8:10a",            // 192.168.1.10
  "::7f00:1",                   // ::127.0.0.1 (compatible)
  "::127.0.0.1",
  "64:ff9b::7f00:1",            // NAT64
  "64:ff9b::a9fe:a9fe",
  "64:ff9b::127.0.0.1",
  "::ffff:0:7f00:1",            // SIIT
  "::ffff:0:127.0.0.1",
  "2002:7f00:1::1",             // 6to4 de 127.0.0.1
];
const escapan = IPV6_CON_IPV4_PRIVADA.filter((ip) => !esIpPrivada(ip));
check("bloquea IPv6 con una IPv4 privada dentro (mapeada, compatible, NAT64, SIIT, 6to4)", escapan.length === 0, escapan.join(", "));
const privadasV6 = ["::", "::1", "0:0:0:0:0:0:0:1", "fe80::1", "fe80::1%eth0", "febf:ffff::1", "fc00::1", "fd12:3456::1", "fdff:ffff::1", "ff02::1", "fec0::1", "64:ff9b:1::1", "2001:db8::1"];
const escapanV6 = privadasV6.filter((ip) => !esIpPrivada(ip));
check("bloquea ::, ::1, fe80::/10, fc00::/7, multidifusión y rangos reservados", escapanV6.length === 0, escapanV6.join(", "));
const publicasV6 = ["2606:2800:220:1::1", "2a00:1450:4003:80e::200e", "2001:4860:4860::8888", "::ffff:5db8:d822", "::ffff:93.184.216.34", "64:ff9b::808:808", "2002:5db8:d822::1", "fe00::1", "fbff::1"];
const bloqueadasPublicas = publicasV6.filter(esIpPrivada);
check("las IPv6 públicas (y las que llevan una IPv4 pública) siguen permitidas", bloqueadasPublicas.length === 0, bloqueadasPublicas.join(", "));
check("una IPv6 mal escrita no se da por buena", esIpPrivada("::ffff:zzzz:1") && esIpPrivada("1::2::3"));
for (const enlace of ["https://[::ffff:127.0.0.1]/", "https://[::ffff:a9fe:a9fe]/latest/meta-data", "https://[::7f00:1]/", "https://[64:ff9b::7f00:1]/", "https://[::ffff:0:7f00:1]/", "https://[0:0:0:0:0:ffff:7f00:1]/", "https://[fe80::1]/", "https://[fd00::1]/", "https://[::]/"]) {
  check(`leerWeb no pide ${enlace}`, (await leerWeb(enlace, { resolver: resolverPublico })).includes("internas") && pedidas === 0);
}
check("rechaza dominio que resuelve a una IPv6 con IPv4 privada dentro", (await leerWeb("https://trampa6.example.com", { resolver: async () => [{ address: "::ffff:7f00:1" }] })).includes("privadas") && pedidas === 0);

globalThis.fetch = async (url) => {
  const u = String(url);
  if (u === "https://portal.example.com/a") return new Response(null, { status: 301, headers: { location: "http://127.0.0.1/secreto" } });
  if (u === "https://portal.example.com/piso") return new Response("<html><title>Ático en Gijón</title><body><p>95 m², 2 baños</p></body></html>", { headers: { "content-type": "text/html; charset=utf-8" } });
  if (u === "https://portal.example.com/bloqueo") return new Response("no", { status: 403 });
  if (u === "https://portal.example.com/foto.jpg") return new Response("xx", { headers: { "content-type": "image/jpeg" } });
  throw new Error("fetch inesperado: " + u);
};
const leida = await leerWeb("https://portal.example.com/piso", { resolver: resolverPublico });
check("lee una página y devuelve título + texto", leida.includes("Título: Ático en Gijón") && leida.includes("95 m², 2 baños"), leida);
check("redirección a IP interna bloqueada", (await leerWeb("https://portal.example.com/a", { resolver: resolverPublico })).includes("internas"));
check("web que bloquea (403) → pide pegar el texto", (await leerWeb("https://portal.example.com/bloqueo", { resolver: resolverPublico })).includes("copie y pegue"));
check("imagen → pide adjuntarla con el clip", (await leerWeb("https://portal.example.com/foto.jpg", { resolver: resolverPublico })).includes("📎"));
globalThis.fetch = realFetch;

console.log("\n— mis_leads (resumen para Clara) —");
check("sin leads → mensaje claro", resumenLeads([]).includes("Todavía no hay leads"));
const rl = resumenLeads([{ id: 2, email: "ana@test.com", nombre: "Ana", telefono: null }, { id: 1, email: "luis@test.com", nombre: "" }]);
check("resume leads omitiendo campos vacíos", rl.includes("Leads registrados: 2") && rl.includes("email: ana@test.com") && !rl.includes("telefono") && !rl.includes("nombre: ·"), rl);
check("acota el número de leads", resumenLeads(Array.from({ length: 40 }, (_, i) => ({ id: i })), 25).split("\n").filter((l) => /^\d+\./.test(l)).length === 25);

console.log("\n— conectores MCP —");
check("sin CLARA_CONECTORES no hay conectores", leerConectores({}).conectores.length === 0);
check("JSON roto → aviso, sin romper", leerConectores({ CLARA_CONECTORES: "{no" }).avisos[0].includes("JSON"));
const cx = leerConectores({
  CLARA_CONECTORES: JSON.stringify([
    { nombre: "Notion", url: "https://mcp.example.com/mcp", token_env: "TOK_N", descripcion: "Notas" },
    { nombre: "malo", url: "http://inseguro.example.com" },
    { nombre: "cal", url: "https://cal.example.com/mcp", herramientas: ["listar_eventos"] },
  ]),
  TOK_N: "secreto-123",
});
check("valida nombres, https y lee el token de otra variable", cx.conectores.length === 2 && cx.conectores[0].nombre === "notion" && cx.conectores[0].token === "secreto-123" && cx.avisos.some((a) => a.includes("https")));
const px = piezasMcp(cx.conectores);
check("mcp_servers con token solo donde lo hay", px.mcp_servers[0].authorization_token === "secreto-123" && !("authorization_token" in px.mcp_servers[1]));
check("lista blanca de herramientas", px.tools[1].default_config.enabled === false && px.tools[1].configs.listar_eventos.enabled === true);
check("el texto de sistema no filtra tokens y pide confirmación", !textoConectores(cx.conectores).includes("secreto") && textoConectores(cx.conectores).includes("confirmación"));

{
  const peticiones = [];
  globalThis.fetch = async (url, init) => {
    peticiones.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
    return new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-sonnet-5", content: [{ type: "text", text: "Hecho" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  process.env.CLARA_CONECTORES = JSON.stringify([{ nombre: "notion", url: "https://mcp.example.com/mcp", token: "tok-x" }]);
  let rr = mockRes();
  await handler({ method: "POST", body: { messages: [{ role: "user", content: "Mira mis notas" }] } }, rr);
  const p0 = peticiones[0];
  const cab = p0 && (p0.headers instanceof Headers ? p0.headers.get("anthropic-beta") : new Headers(p0.headers).get("anthropic-beta"));
  check("con conector: va por la API beta con mcp-client", rr.r.body?.reply === "Hecho" && String(cab).includes("mcp-client-2025-11-20"), String(cab));
  check("con conector: manda mcp_servers y su mcp_toolset", p0.body.mcp_servers?.[0]?.name === "notion" && p0.body.tools.some((t) => t.type === "mcp_toolset" && t.mcp_server_name === "notion"));
  delete process.env.CLARA_CONECTORES;
  peticiones.length = 0;
  rr = mockRes();
  await handler({ method: "POST", body: { messages: [{ role: "user", content: "Hola" }] } }, rr);
  check("sin conector: petición normal, sin beta ni mcp_servers", !peticiones[0].body.mcp_servers && !new Headers(peticiones[0].headers).get("anthropic-beta"));
  globalThis.fetch = realFetch;
}

console.log("\n— segunda_opinion (OpenRouter) —");
check("sin clave → aviso claro", (await consultarModelo({ pregunta: "hola" }, {})).includes("OPENROUTER_API_KEY"));
check("nombre de modelo raro → rechazado sin llamar", (await consultarModelo({ pregunta: "hola", modelo: "gpt5; rm -rf" }, { OPENROUTER_API_KEY: "k" })).includes("no es válido"));
{
  const llamadas = [];
  globalThis.fetch = async (url, init) => {
    llamadas.push({ url: String(url), init, body: JSON.parse(init.body) });
    if (JSON.parse(init.body).model === "sin/saldo") return new Response(JSON.stringify({ error: { message: "no credits" } }), { status: 402 });
    return new Response(JSON.stringify({ model: "google/gemini-x", choices: [{ message: { content: "Coincido: la rentabilidad bruta ronda el 8 %." } }] }), { status: 200 });
  };
  const r = await consultarModelo({ pregunta: "¿Es buena esta inversión?", contexto: "Piso 98.000 €, alquiler 650 €" }, { OPENROUTER_API_KEY: "k-or" });
  check("llama a OpenRouter con Bearer y openrouter/auto por defecto", llamadas[0].url === "https://openrouter.ai/api/v1/chat/completions" && llamadas[0].init.headers.Authorization === "Bearer k-or" && llamadas[0].body.model === "openrouter/auto");
  check("manda contexto y pregunta", JSON.stringify(llamadas[0].body.messages).includes("98.000") && llamadas[0].body.messages.at(-1).content.includes("inversión"));
  check("devuelve la respuesta con el modelo usado", r.includes("google/gemini-x") && r.includes("rentabilidad bruta"));
  check("sin saldo (402) → mensaje claro", (await consultarModelo({ pregunta: "x", modelo: "sin/saldo" }, { OPENROUTER_API_KEY: "k" })).includes("saldo"));
  globalThis.fetch = realFetch;
}

console.log("\n— puente MCP (conectores con cabecera propia, p. ej. Composio) —");
{
  const entorno = {
    CLARA_CONECTORES: JSON.stringify([{ nombre: "composio", url: "https://backend.composio.example/v3/mcp/abc?user_id=pau", cabeceras: { "x-api-key": "COMPOSIO_API_KEY" } }]),
    COMPOSIO_API_KEY: "clave-composio",
    VERCEL_PROJECT_PRODUCTION_URL: "jpmr-negocios.vercel.app",
  };
  Object.assign(process.env, entorno);
  const cx2 = leerConectores();
  const c0 = cx2.conectores[0];
  check("conector con cabeceras → Claude ve la url del puente, no la real", c0?.url === "https://jpmr-negocios.vercel.app/api/mcp-puente?c=composio" && !JSON.stringify(piezasMcp(cx2.conectores)).includes("clave-composio") && !JSON.stringify(piezasMcp(cx2.conectores)).includes("backend.composio"));
  check("Claude se identifica con el secreto del puente", piezasMcp(cx2.conectores).mcp_servers[0].authorization_token === secretoPuente());

  const reenvios = [];
  globalThis.fetch = async (url, init) => {
    reenvios.push({ url: String(url), init });
    return new Response('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n', { status: 200, headers: { "content-type": "text/event-stream", "mcp-session-id": "ses-1" } });
  };
  const resP = () => {
    const r = { statusCode: 0, headers: {}, chunks: [], ended: false, body: null };
    return { r, status(c) { r.statusCode = c; return this; }, json(b) { r.body = b; return this; }, writeHead(c, h) { r.statusCode = c; Object.assign(r.headers, h); }, write(x) { r.chunks.push(Buffer.from(x).toString()); }, end() { r.ended = true; } };
  };
  let rp = resP();
  await puente({ method: "POST", query: { c: "composio" }, headers: { authorization: "Bearer malo" }, body: {} }, rp);
  check("sin el secreto → 401 y no reenvía", rp.r.statusCode === 401 && reenvios.length === 0);
  rp = resP();
  await puente({ method: "POST", query: { c: "otro" }, headers: { authorization: `Bearer ${secretoPuente()}` }, body: {} }, rp);
  check("conector desconocido → 404 (no es un proxy abierto)", rp.r.statusCode === 404 && reenvios.length === 0);
  rp = resP();
  await puente({ method: "POST", query: { c: "composio" }, headers: { authorization: `Bearer ${secretoPuente()}`, "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-session-id": "ses-1" }, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } }, rp);
  const ida = reenvios[0];
  check("reenvía a la url real con x-api-key y sin el secreto del puente", ida?.url === "https://backend.composio.example/v3/mcp/abc?user_id=pau" && ida.init.headers["x-api-key"] === "clave-composio" && !JSON.stringify(ida.init.headers).includes(secretoPuente()));
  check("pasa el cuerpo JSON-RPC y la sesión MCP", JSON.parse(ida.init.body).method === "tools/list" && ida.init.headers["mcp-session-id"] === "ses-1");
  check("devuelve el streaming y la sesión tal cual", rp.r.statusCode === 200 && rp.r.headers["mcp-session-id"] === "ses-1" && rp.r.chunks.join("").includes('"jsonrpc"') && rp.r.ended);
  for (const k of Object.keys(entorno)) delete process.env[k];
  globalThis.fetch = realFetch;
}

// ---------------------------------------------------------------------------
console.log(`\nResultado: ${pasados} pasados, ${fallados} fallados.\n`);
process.exit(fallados === 0 ? 0 : 1);
