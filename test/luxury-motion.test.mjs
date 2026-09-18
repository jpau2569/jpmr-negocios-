// ============================================================================
//  Tests de Castresana Luxury Motion — npm test los ejecuta
// ----------------------------------------------------------------------------
//  No llaman a ninguna API real: la respuesta de Claude se simula
//  interceptando fetch. Verifican:
//    · que el formulario de castresana-luxury-motion.html y los catálogos de
//      lib/luxury-motion.js no se desincronicen,
//    · la validación del briefing (nada fuera del catálogo entra),
//    · el estudio local (escenas, tiempos, honestidad y variantes),
//    · el handler: validación, modo estudio, modo IA y caída a estudio.
// ============================================================================

import { readFileSync } from "node:fs";
import path from "node:path";
import handler, { briefingParaModelo, extraerJSON, normalizarCampanaIA } from "../api/_luxury-motion.js";
import {
  TIPOS, CARACTERISTICAS, CLIENTES, OBJETIVOS, PLATAFORMAS, DURACIONES, ESTILOS, GENERADORES,
  MOVIMIENTOS_EN, NEGATIVE_PROMPT, MARCA,
  normalizarBriefing, componerCampana, campanaATexto, fichaDelInmueble,
} from "../lib/luxury-motion.js";

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

const BRIEF_OK = {
  referencia: "AC-1042",
  tipo: "atico",
  localizacion: "Oviedo, El Antiguo",
  precio: "295.000 €",
  metros: "120",
  habitaciones: "3",
  banos: "2",
  caracteristicas: ["terraza", "vistas"],
  cliente: "premium",
  objetivo: "vender",
  plataforma: "ig-reel",
  duracion: "30",
  estilo: "cine-lujo",
  generador: "veo",
};

// ---------------------------------------------------------------------------
console.log("\n— formulario ↔ catálogos (copias vigiladas) —");
// ---------------------------------------------------------------------------
const HTML = readFileSync(path.join(process.cwd(), "castresana-luxury-motion.html"), "utf8");

function valoresDeSelect(id) {
  const bloque = HTML.split(`id="${id}"`)[1];
  if (!bloque) return [];
  const hasta = bloque.indexOf("</select>");
  return [...bloque.slice(0, hasta).matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
}

function mismos(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

check("tipos de inmueble sincronizados", mismos(valoresDeSelect("tipo"), TIPOS.map((t) => t.id)), valoresDeSelect("tipo").join(","));
check("clientes objetivo sincronizados", mismos(valoresDeSelect("cliente"), CLIENTES.map((c) => c.id)));
check("objetivos sincronizados", mismos(valoresDeSelect("objetivo"), OBJETIVOS.map((o) => o.id)));
check("plataformas sincronizadas", mismos(valoresDeSelect("plataforma"), PLATAFORMAS.map((p) => p.id)));
check("duraciones sincronizadas", mismos(valoresDeSelect("duracion"), DURACIONES.map((d) => d.id)));
check("estilos sincronizados", mismos(valoresDeSelect("estilo"), ESTILOS.map((e) => e.id)));
check("generadores de vídeo sincronizados", mismos(valoresDeSelect("generador-video"), GENERADORES.map((g) => g.id)));

const chips = [...HTML.split('id="caracteristicas"')[1].split("</div>")[0].matchAll(/value="([^"]+)"/g)].map((m) => m[1]);
check("características sincronizadas", mismos(chips, CARACTERISTICAS.map((c) => c.id)), chips.join(","));

check("el teléfono del despacho aparece en el pie", MARCA.telefonos.every((t) => HTML.includes(t)));
check("la web de la marca aparece en el pie", HTML.includes(MARCA.web));
check("la página apunta al endpoint correcto", HTML.includes('fetch("/api/luxury-motion"'));

// ---------------------------------------------------------------------------
console.log("\n— normalizarBriefing() —");
// ---------------------------------------------------------------------------
let n = normalizarBriefing(BRIEF_OK);
check("briefing completo → ok", n.ok && n.briefing.tipo.id === "atico");
check("números convertidos", n.briefing.metros === 120 && n.briefing.habitaciones === 3 && n.briefing.banos === 2);
check("características resueltas", n.briefing.caracteristicas.map((c) => c.id).join(",") === "terraza,vistas");

check("sin localización → error", !normalizarBriefing({ ...BRIEF_OK, localizacion: "   " }).ok);
check("tipo inventado → error", !normalizarBriefing({ ...BRIEF_OK, tipo: "castillo" }).ok);
check("estilo inventado → error", !normalizarBriefing({ ...BRIEF_OK, estilo: "../../etc/passwd" }).ok);
check("duración inventada → error", !normalizarBriefing({ ...BRIEF_OK, duracion: "900" }).ok);

n = normalizarBriefing({
  ...BRIEF_OK,
  generador: "no-existe",
  caracteristicas: ["terraza", "terraza", "piscina-de-oro", 42, null],
  metros: "no sé",
  habitaciones: "-4",
  localizacion: "  Oviedo,\n\n   centro  ",
  referencia: "x".repeat(120),
});
check("generador desconocido → prompt universal", n.briefing.generador.id === "universal");
check("características duplicadas o falsas descartadas", n.briefing.caracteristicas.map((c) => c.id).join(",") === "terraza");
check("números imposibles → null", n.briefing.metros === null && n.briefing.habitaciones === null);
check("texto libre saneado", n.briefing.localizacion === "Oviedo, centro" && n.briefing.referencia.length === 40);

n = normalizarBriefing({ ...BRIEF_OK, variante: "7" });
check("variante acotada y numérica", n.briefing.variante === 7);
check("variante disparatada se acota", normalizarBriefing({ ...BRIEF_OK, variante: 9999 }).briefing.variante === 99);

// ---------------------------------------------------------------------------
console.log("\n— estudio local: guion y honestidad —");
// ---------------------------------------------------------------------------
const b = normalizarBriefing(BRIEF_OK).briefing;
const campana = componerCampana(b);

check("motor marcado como estudio", campana.motor === "estudio");
check("nº de escenas según la duración", campana.escenas.length === 6);
check("el guion empieza en 0 y acaba en la duración pedida",
  campana.escenas[0].desde === 0 && campana.escenas.at(-1).hasta === 30);
check("los tramos encadenan sin huecos",
  campana.escenas.every((e, i) => i === 0 || e.desde === campana.escenas[i - 1].hasta));
check("la última escena es el cierre de marca", campana.escenas.at(-1).etiqueta === "Cierre de marca");
check("el cierre lleva la CTA y la web",
  campana.escenas.at(-1).texto.includes("Solicita tu visita privada") && campana.escenas.at(-1).texto.includes(MARCA.web));
check("todos los movimientos de cámara están en el catálogo",
  campana.escenas.every((e) => MOVIMIENTOS_EN[e.camara]), campana.escenas.map((e) => e.camara).join(" / "));
check("cada característica marcada tiene su escena",
  ["Terraza", "Vistas"].every((t) => campana.escenas.some((e) => e.etiqueta === t)));

check("el prompt en español lleva formato, luz y óptica",
  campana.promptES.includes("9:16") && campana.promptES.includes("Luz:") && campana.promptES.includes("Óptica:"));
check("el prompt en inglés es de producción",
  campana.promptEN.includes("photorealistic") && campana.promptEN.includes("Shot list:"));
check("el prompt en inglés traduce los movimientos",
  campana.promptEN.includes(MOVIMIENTOS_EN[campana.escenas[0].camara]));
check("el prompt del motor elegido se anota", campana.promptES.includes("Google Veo"));
check("negative prompt completo", campana.negativePrompt === NEGATIVE_PROMPT && campana.negativePromptEN.includes("readable text"));
check("tres variantes alternativas",
  campana.variantes.length === 3 && campana.variantes.map((v) => v.tipo).join(",") === "Emocional,Cinematográfica,Directa para conversión");
check("CTA final con marca y web", campana.cta.includes(MARCA.nombre) && campana.cta.includes(MARCA.web));

// Lo que no está en el briefing no puede aparecer en la parte creativa.
const creativo = [
  campana.titulo, campana.concepto, campana.eslogan, campana.promptES, campana.promptEN,
  campana.vozEnOff, campana.copyInstagram, campana.copyTiktok, campana.youtube.descripcion,
  ...campana.escenas.map((e) => `${e.accion} ${e.etiqueta} ${e.texto}`),
].join(" ").toLowerCase();
check("no inventa piscina", !creativo.includes("piscina"));
check("no inventa jardín", !creativo.includes("jardín"));
check("no inventa garaje", !creativo.includes("garaje"));
check("sí usa los datos reales", creativo.includes("120 m²") && creativo.includes("295.000"));

// Briefing mínimo: ni metros, ni precio, ni características.
const pelado = normalizarBriefing({
  tipo: "piso", localizacion: "Mieres", cliente: "familia", objetivo: "visitas",
  plataforma: "tiktok", duracion: "15", estilo: "emocional-familiar", generador: "pika",
}).briefing;
const campanaPelada = componerCampana(pelado);
const creativoPelado = [
  campanaPelada.concepto, campanaPelada.promptES, campanaPelada.vozEnOff,
  campanaPelada.copyInstagram, ...campanaPelada.escenas.map((e) => e.accion),
].join(" ").toLowerCase();
check("sin datos no menciona metros ni precio",
  !/m²|\d+\s*€|habitacion/.test(creativoPelado), creativoPelado.slice(0, 160));
check("sin características avisa de ello",
  campanaPelada.notas.some((x) => x.includes("No has marcado características")));
check("avisa de los datos que faltan",
  campanaPelada.notas.some((x) => x.includes("superficie") && x.includes("precio")));
check("avisa de que los textos van en edición",
  campanaPelada.notas.some((x) => x.includes("edición")));
check("15 s → 4 escenas que suman 15", campanaPelada.escenas.length === 4 && campanaPelada.escenas.at(-1).hasta === 15);
check("el relleno honesto no repite el mismo plano",
  new Set(campanaPelada.escenas.map((e) => e.accion)).size === campanaPelada.escenas.length);

for (const d of DURACIONES) {
  const bd = normalizarBriefing({ ...BRIEF_OK, duracion: d.id }).briefing;
  const c = componerCampana(bd);
  check(`${d.nombre}: ${d.escenas} escenas que suman ${d.segundos} s`,
    c.escenas.length === d.escenas && c.escenas.at(-1).hasta === d.segundos);
}

// Regenerar versión tiene que dar algo distinto.
const v0 = componerCampana(normalizarBriefing({ ...BRIEF_OK, variante: 0 }).briefing);
const v1 = componerCampana(normalizarBriefing({ ...BRIEF_OK, variante: 1 }).briefing);
check("otra variante cambia título y eslogan", v0.titulo !== v1.titulo && v0.eslogan !== v1.eslogan);

const texto = campanaATexto(campana, b);
check("el texto descargable trae los 15 apartados",
  ["1. CONCEPTO", "4. PROMPT MAESTRO", "6. GUION POR ESCENAS", "13. NEGATIVE PROMPT", "15. AVISOS"].every((t) => texto.includes(t)));
check("el texto descargable cierra con la marca",
  MARCA.cierres.every((linea) => texto.includes(linea)) && texto.includes(MARCA.telefonos[2]));
check("fichaDelInmueble se lee de corrido", fichaDelInmueble(b).startsWith("ático en Oviedo, El Antiguo"));

// ---------------------------------------------------------------------------
console.log("\n— briefingParaModelo() —");
// ---------------------------------------------------------------------------
const mensaje = briefingParaModelo(pelado);
check("marca lo no indicado como tal", mensaje.includes("NO INDICADO") && mensaje.includes("NINGUNA"));
check("incluye plataforma, duración y estilo",
  mensaje.includes("TikTok 9:16") && mensaje.includes("15 segundos") && mensaje.includes("Emocional y familiar"));
const mensajeVariante = briefingParaModelo(normalizarBriefing({ ...BRIEF_OK, variante: 2 }).briefing);
check("la regeneración pide otro ángulo", mensajeVariante.includes("versión número 3"));

// ---------------------------------------------------------------------------
console.log("\n— extraerJSON() y normalizarCampanaIA() —");
// ---------------------------------------------------------------------------
check("JSON limpio", extraerJSON('{"titulo":"A"}')?.titulo === "A");
check("JSON entre vallas", extraerJSON('```json\n{"titulo":"B"}\n```')?.titulo === "B");
check("JSON con frase alrededor", extraerJSON('Aquí tienes:\n{"titulo":"C"}\nUn saludo')?.titulo === "C");
check("texto sin JSON → null", extraerJSON("lo siento, no puedo") === null);

const iaParcial = normalizarCampanaIA({ titulo: "Título de la IA", escenas: "esto no es un array" }, campana, b);
check("campos que faltan se rellenan con el estudio",
  iaParcial.motor === "ia" && iaParcial.titulo === "Título de la IA" && iaParcial.escenas === campana.escenas);
check("el negative prompt de la casa nunca se pierde", iaParcial.negativePrompt.startsWith(NEGATIVE_PROMPT));
check("los avisos de honestidad se calculan siempre", iaParcial.notas.length > 0);

const iaSuma = normalizarCampanaIA({ negativePrompt: "sin coches de lujo" }, campana, b);
check("el negative prompt del modelo se suma al de la casa",
  iaSuma.negativePrompt.startsWith(NEGATIVE_PROMPT) && iaSuma.negativePrompt.endsWith("sin coches de lujo"));
check("hashtags sin almohadilla se corrigen",
  normalizarCampanaIA({ hashtags: ["Oviedo", "#Asturias"] }, campana, b).hashtags.join(" ") === "#Oviedo #Asturias");

// ---------------------------------------------------------------------------
console.log("\n— handler: validación y modo estudio —");
// ---------------------------------------------------------------------------
delete process.env.ANTHROPIC_API_KEY;

let res = mockRes();
await handler({ method: "GET" }, res);
check("GET → 405", res.r.statusCode === 405);

res = mockRes();
await handler({ method: "POST", body: { tipo: "piso" } }, res);
check("briefing incompleto → 400 con los errores", res.r.statusCode === 400 && Array.isArray(res.r.body.errores));

res = mockRes();
await handler({ method: "POST", body: { ...BRIEF_OK, motor: "estudio" } }, res);
check("modo estudio → 200 con campaña", res.r.statusCode === 200 && res.r.body.campana.motor === "estudio");
check("devuelve texto descargable y ficha",
  res.r.body.texto.includes("CASTRESANA LUXURY MOTION") && res.r.body.ficha.includes("Oviedo"));
check("modo estudio pedido a propósito no avisa de nada", res.r.body.aviso === null);
check("no se cachea la respuesta", res.r.headers["Cache-Control"] === "no-store");

res = mockRes();
await handler({ method: "POST", body: { ...BRIEF_OK } }, res);
check("sin clave → campaña de estudio y aviso claro",
  res.r.statusCode === 200 && res.r.body.campana.motor === "estudio" && res.r.body.aviso.includes("ANTHROPIC_API_KEY"));

// ---------------------------------------------------------------------------
console.log("\n— handler: modo IA (Claude simulado) —");
// ---------------------------------------------------------------------------
process.env.ANTHROPIC_API_KEY = "sk-ant-test";
const realFetch = globalThis.fetch;
const llamadas = [];

function respondeClaude(texto) {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.includes("anthropic.com")) throw new Error("fetch inesperado: " + u);
    llamadas.push(JSON.parse(init.body));
    return new Response(
      JSON.stringify({
        id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5",
        content: [{ type: "text", text: texto }],
        stop_reason: "end_turn",
        usage: { input_tokens: 500, output_tokens: 900 },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
}

respondeClaude(
  JSON.stringify({
    titulo: "Oviedo desde otra perspectiva",
    concepto: "Un ático que se descubre por la luz.",
    eslogan: "La ciudad, a la altura justa.",
    perfilComprador: "Comprador premium de Oviedo.",
    promptES: "Prompt en español con dolly in muy lento.",
    promptEN: "Master prompt in English, very slow dolly in.",
    escenas: [
      { n: 1, desde: 0, hasta: 15, etiqueta: "Apertura", plano: "Plano general", camara: "dron ascendente", luz: "Hora dorada.", accion: "La ciudad al fondo.", texto: "" },
      { n: 2, desde: 15, hasta: 30, etiqueta: "Cierre de marca", plano: "Plano medio", camara: "paneo lento", luz: "Hora dorada.", accion: "Cierre.", texto: "Solicita tu visita privada" },
    ],
    vozEnOff: "Hay áticos que no se enseñan: se presentan.",
    copyInstagram: "Copy de Instagram.",
    copyTiktok: "Copy de TikTok.",
    youtube: { titulo: "Ático en Oviedo", descripcion: "Descripción." },
    hashtags: ["#Oviedo", "#Asturias"],
    cta: "Solicita tu visita privada · asesoriacastresana.com",
    negativePrompt: "sin drones visibles",
    variantes: [{ tipo: "Emocional", titulo: "V1", idea: "Idea 1." }],
    notas: ["Nota de la IA."],
  })
);

res = mockRes();
await handler({ method: "POST", body: { ...BRIEF_OK } }, res);
check("modo IA → 200 sin aviso", res.r.statusCode === 200 && res.r.body.aviso === null);
check("la campaña viene de la IA",
  res.r.body.campana.motor === "ia" && res.r.body.campana.titulo === "Oviedo desde otra perspectiva");
check("las escenas de la IA se respetan", res.r.body.campana.escenas.length === 2);
check("las notas propias se añaden a las de la IA",
  res.r.body.campana.notas.includes("Nota de la IA.") && res.r.body.campana.notas.some((x) => x.includes("edición")));

const enviado = llamadas[0];
check("usa el modelo y el límite previstos", enviado.model === "claude-sonnet-5" && enviado.max_tokens === 8000);
check("el prompt maestro viaja en el system",
  enviado.system[0].text.includes("CASTRESANA LUXURY MOTION") && enviado.system[0].text.includes("Normas críticas"));
check("el prompt maestro va cacheado", enviado.system[0].cache_control?.type === "ephemeral");
check("el briefing viaja como mensaje del usuario",
  enviado.messages[0].role === "user" && enviado.messages[0].content.includes("Oviedo, El Antiguo"));

// Respuesta ilegible → campaña del estudio, nunca un error en blanco.
llamadas.length = 0;
respondeClaude("Lo siento, hoy no.");
res = mockRes();
await handler({ method: "POST", body: { ...BRIEF_OK } }, res);
check("respuesta ilegible → campaña de estudio con aviso",
  res.r.statusCode === 200 && res.r.body.campana.motor === "estudio" && res.r.body.aviso.includes("Regenerar"));

// La API cae → el estudio responde igualmente.
globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "boom" } }), {
  status: 500, headers: { "content-type": "application/json" },
});
res = mockRes();
await handler({ method: "POST", body: { ...BRIEF_OK } }, res);
check("API caída → campaña de estudio con aviso",
  res.r.statusCode === 200 && res.r.body.campana.motor === "estudio" && Boolean(res.r.body.aviso));
check("aun cayendo la IA, la campaña está completa",
  res.r.body.campana.escenas.length === 6 && res.r.body.texto.includes("NEGATIVE PROMPT"));

globalThis.fetch = realFetch;
delete process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
console.log(`\n${fallados === 0 ? "✅" : "❌"} Luxury Motion: ${pasados} comprobaciones correctas, ${fallados} fallidas.\n`);
process.exit(fallados === 0 ? 0 : 1);
