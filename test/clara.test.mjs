// ============================================================================
//  Tests de la API de Clara — se ejecutan con: npm test
// ----------------------------------------------------------------------------
//  No llaman a ninguna API real: se simulan las respuestas de Claude y de
//  Perplexity interceptando fetch. Verifican la calculadora, la búsqueda,
//  la validación de entradas y el flujo completo (persona + fecha + memoria
//  + modo + bucle de herramientas).
// ============================================================================

import handler, { buscarEnPerplexity, calcular } from "../api/clara.js";

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
  const r = { statusCode: 0, body: null, headers: {} };
  return {
    status(c) { r.statusCode = c; return this; },
    json(b) { r.body = b; return this; },
    setHeader(k, v) { r.headers[k] = v; },
    r,
  };
}

const realFetch = globalThis.fetch;

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
check("declara las 2 herramientas", (llamadasAnthropic[0]?.tools || []).length === 2);

const segundaRonda = llamadasAnthropic[1]?.messages || [];
const toolResult = JSON.stringify(segundaRonda);
check("2ª ronda: incluye el tool_result del cálculo", toolResult.includes("tool_result") && toolResult.includes("7.959184"));

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

globalThis.fetch = realFetch;

// ---------------------------------------------------------------------------
console.log(`\nResultado: ${pasados} pasados, ${fallados} fallados.\n`);
process.exit(fallados === 0 ? 0 : 1);
