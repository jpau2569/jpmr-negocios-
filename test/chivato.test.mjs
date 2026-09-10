// ============================================================================
//  Tests de Chivato AI — se ejecutan con: npm test
// ----------------------------------------------------------------------------
//  No salen a Internet: la llamada a la API de Claude se sustituye por una
//  falsa. Verifican el catálogo de testigos, los dibujos, el endpoint (que
//  la IA solo identifica y el texto sale del catálogo) y la PWA.
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (r) => readFileSync(join(RAIZ, r), "utf8");
const json = (r) => JSON.parse(leer(r));

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

function mockRes() {
  const r = { statusCode: 0, body: null, headers: {} };
  return {
    status(c) { r.statusCode = c; return this; },
    json(b) { r.body = b; return this; },
    setHeader(k, v) { r.headers[k] = v; },
    end() { return this; },
    r,
  };
}

// ── Catálogo ────────────────────────────────────────────────────────────────
console.log("\n🚗 Catálogo de testigos");
const catalogo = json("chivato/datos/testigos.json");
const T = catalogo.testigos;
{
  check("tiene un catálogo amplio", T.length >= 95, `${T.length} testigos`);
  check("no hay identificadores repetidos", new Set(T.map((t) => t.id)).size === T.length);

  const COLORES = ["rojo", "ambar", "verde", "azul"];
  const GRAVEDAD = ["critico", "atencion", "informativo"];
  const CONDUCIR = ["no", "taller", "si"];
  check("todos los campos obligatorios están completos", T.every((t) =>
    t.id && t.nombre && t.forma && t.significado && t.que_hacer && t.coste &&
    Array.isArray(t.causas) && t.causas.length &&
    Array.isArray(t.otros_nombres) && t.otros_nombres.length));
  check("colores, gravedades y 'se puede conducir' son valores válidos", T.every((t) =>
    COLORES.includes(t.color) && GRAVEDAD.includes(t.gravedad) && CONDUCIR.includes(t.conducir)));
  check("cada categoría está declarada", T.every((t) => catalogo.categorias[t.categoria]));

  // Un testigo rojo crítico nunca puede decir "puedes conducir con normalidad".
  check("ningún crítico invita a seguir conduciendo",
    T.filter((t) => t.gravedad === "critico").every((t) => t.conducir !== "si"),
    T.filter((t) => t.gravedad === "critico" && t.conducir === "si").map((t) => t.id).join(", "));

  // Los testigos que más motores rompen tienen que estar sí o sí.
  const IMPRESCINDIBLES = [
    "motor-mil", "aceite-presion", "temperatura-refrigerante", "bateria-carga", "airbag",
    "abs", "esp", "tpms", "freno-sistema", "cinturon", "direccion-asistida", "dpf", "adblue",
    "precalentamiento", "combustible-reserva", "luces-largas", "intermitente-izq",
    "antiniebla-trasera", "start-stop", "bateria-alta-tension", "carga-en-curso", "mantenimiento",
  ];
  const faltan = IMPRESCINDIBLES.filter((id) => !T.some((t) => t.id === id));
  check("están los testigos de cualquier coche actual", faltan.length === 0, faltan.join(", "));

  check("cubre gasolina, diésel, híbrido y eléctrico",
    ["escape", "electrico", "combustible", "motor"].every((c) => T.some((t) => t.categoria === c)));
  check("hay testigos de los tres niveles de gravedad",
    GRAVEDAD.every((g) => T.filter((t) => t.gravedad === g).length >= 10));
}

// ── Dibujos ─────────────────────────────────────────────────────────────────
console.log("\n🎨 Dibujos de los testigos");
{
  const { ICONOS, svgTestigo, CLAVES_ICONO } = await import("../chivato/js/iconos.js");
  check("cada testigo tiene su dibujo", T.every((t) => ICONOS[t.icono]),
    T.filter((t) => !ICONOS[t.icono]).map((t) => t.icono).join(", "));
  check("no sobran dibujos sin usar",
    CLAVES_ICONO.every((k) => k === "interrogacion" || T.some((t) => t.icono === k)),
    CLAVES_ICONO.filter((k) => k !== "interrogacion" && !T.some((t) => t.icono === k)).join(", "));
  check("el SVG hereda el color de la tarjeta",
    T.every((t) => svgTestigo(t).includes('stroke="currentColor"')));
  check("un testigo desconocido no rompe el render",
    svgTestigo({ icono: "no-existe", categoria: "motor" }).includes("<svg") &&
    svgTestigo({}).includes("<svg"));
}

// ── Endpoint: la IA identifica, el catálogo explica ─────────────────────────
console.log("\n🤖 Análisis de la foto");
{
  const anterior = process.env.ANTHROPIC_API_KEY;

  // Sin clave: se avisa, pero el catálogo sigue estando disponible.
  delete process.env.ANTHROPIC_API_KEY;
  const { default: handler } = await import("../chivato/api/chivato.js");
  let res = mockRes();
  await handler({ method: "POST", body: { imagen: "abc" } }, res);
  check("sin clave de IA avisa sin romper", res.r.statusCode === 503 && res.r.body.sin_ia === true);

  res = mockRes();
  await handler({ method: "GET" }, res);
  check("solo acepta POST", res.r.statusCode === 405);

  // Con clave falsa y respuesta simulada: se intercepta la red, así que el
  // SDK de verdad hace su trabajo y solo se finge lo que contesta el modelo.
  process.env.ANTHROPIC_API_KEY = "sk-de-prueba";
  const fetchOriginal = globalThis.fetch;
  let ultimaPeticion = null;
  const responder = (texto) => {
    globalThis.fetch = async (url, opciones) => {
      ultimaPeticion = JSON.parse(opciones.body);
      return new Response(JSON.stringify({
        id: "msg_prueba", type: "message", role: "assistant", model: "claude-sonnet-5",
        content: [{ type: "text", text: texto }], stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 10 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
  };

  responder(JSON.stringify({
    testigos: [
      { id: "aceite-presion", estado: "fijo", confianza: "alta", observacion: "arriba a la izquierda" },
      { id: "motor-mil", estado: "parpadeando", confianza: "media", observacion: "" },
      { id: "testigo-que-no-existe", estado: "fijo", confianza: "alta", observacion: "" },
    ],
    no_identificados: [{ descripcion: "un cuadrado con una A", color: "ambar" }],
    calidad_foto: "buena", consejo_foto: "", mensaje: "", lectura_extra: "78.400 km",
  }));

  res = mockRes();
  await handler({ method: "POST", body: { imagen: "ZmFrZQ==", mime: "image/jpeg" } }, res);
  const salida = res.r.body;
  check("responde 200 con los testigos compuestos", res.r.statusCode === 200 && salida.testigos.length === 2);
  check("descarta los identificadores inventados por la IA",
    salida.ignorados.includes("testigo-que-no-existe") &&
    !salida.testigos.some((t) => t.id === "testigo-que-no-existe"));
  check("el texto sale del catálogo, no del modelo", (() => {
    const ficha = T.find((t) => t.id === "aceite-presion");
    const dado = salida.testigos.find((t) => t.id === "aceite-presion");
    return dado.significado === ficha.significado && dado.que_hacer === ficha.que_hacer &&
      dado.coste === ficha.coste && dado.causas.length === ficha.causas.length;
  })());
  check("ordena lo más grave primero", salida.testigos[0].gravedad === "critico");
  check("conserva el estado que vio la IA",
    salida.testigos.find((t) => t.id === "motor-mil").estado === "parpadeando");
  check("pasa los datos que se leen en el cuadro", salida.lectura_extra === "78.400 km");
  check("el análisis nunca se cachea", res.r.headers["Cache-Control"] === "no-store");
  check("a la IA se le manda la foto y la lista de testigos para elegir",
    ultimaPeticion.system.includes("aceite-presion") &&
    ultimaPeticion.messages[0].content.some((b) => b.type === "image"));
  check("se le pide que no explique ni estime costes",
    ultimaPeticion.system.includes("no estimes costes"));

  // JSON envuelto en un bloque de código: también tiene que valer.
  responder("```json\n{\"testigos\":[{\"id\":\"abs\",\"estado\":\"fijo\",\"confianza\":\"alta\"}]}\n```");
  res = mockRes();
  await handler({ method: "POST", body: { imagen: "ZmFrZQ==" } }, res);
  check("entiende el JSON aunque venga en un bloque de código",
    res.r.statusCode === 200 && res.r.body.testigos[0].id === "abs");

  // Respuesta ilegible.
  responder("lo siento, no puedo");
  res = mockRes();
  await handler({ method: "POST", body: { imagen: "ZmFrZQ==" } }, res);
  check("avisa si la IA no devuelve un JSON legible", res.r.statusCode === 502);

  // Imagen que falta o desmesurada.
  res = mockRes();
  await handler({ method: "POST", body: {} }, res);
  check("pide la imagen si no llega", res.r.statusCode === 400);

  res = mockRes();
  await handler({ method: "POST", body: { imagen: "x".repeat(6 * 1024 * 1024) } }, res);
  check("rechaza fotos demasiado pesadas", res.r.statusCode === 413);

  // Seguimiento por chat.
  responder("Puedes llegar a casa, pero no fuerces el motor.");
  res = mockRes();
  await handler({ method: "POST", body: { accion: "preguntar", pregunta: "¿Llego a casa?", testigos: ["abs"] } }, res);
  check("responde a las preguntas de seguimiento",
    res.r.statusCode === 200 && res.r.body.respuesta.includes("casa"));

  res = mockRes();
  await handler({ method: "POST", body: { accion: "preguntar", pregunta: "  " } }, res);
  check("no acepta una pregunta vacía", res.r.statusCode === 400);

  globalThis.fetch = fetchOriginal;
  if (anterior === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = anterior;
}

// ── PWA y despliegue ────────────────────────────────────────────────────────
console.log("\n📱 PWA e integración");
{
  const manifest = json("chivato/manifest.json");
  check("el manifiesto tiene nombre, colores e iconos",
    manifest.name.includes("Chivato") && manifest.theme_color && manifest.icons.length >= 5);
  check("hay icono maskable de 192 y de 512",
    ["192x192", "512x512"].every((s) =>
      manifest.icons.some((i) => i.sizes === s && i.purpose === "maskable")));
  check("todos los iconos del manifiesto existen",
    manifest.icons.every((i) => existsSync(join(RAIZ, "chivato", i.src))),
    manifest.icons.filter((i) => !existsSync(join(RAIZ, "chivato", i.src))).map((i) => i.src).join(", "));

  const sw = leer("chivato/service-worker.js");
  const enCache = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter((r) => r !== "");
  check("el service worker cachea archivos que existen",
    enCache.every((r) => existsSync(join(RAIZ, "chivato", r))),
    enCache.filter((r) => !existsSync(join(RAIZ, "chivato", r))).join(", "));
  check("el análisis por IA nunca se sirve de la caché", sw.includes("/api/"));
  check("el catálogo sí se guarda para usarlo sin conexión", sw.includes("datos/testigos.json"));

  const html = leer("chivato/index.html");
  check("el aviso legal está en la portada",
    html.includes("no sustituye el diagnóstico") && html.includes("lugar seguro"));
  check("la cámara del móvil se abre por detrás", html.includes('capture="environment"'));
  check("la app está enlazada al manifiesto y al icono de iOS",
    html.includes('rel="manifest"') && html.includes("apple-touch-icon"));

  const reenvio = leer("api/chivato.js");
  check("la ruta /api/chivato del monorepo apunta a la app",
    reenvio.includes("../chivato/api/chivato.js"));

  const vercel = json("vercel.json");
  check("la función tiene tiempo y datos suficientes en Vercel",
    vercel.functions["api/chivato.js"]?.maxDuration >= 60 &&
    String(vercel.functions["api/chivato.js"]?.includeFiles || "").includes("chivato"));
}

console.log(`\n${fallados === 0 ? "✅" : "❌"} Chivato AI: ${pasados} pasados, ${fallados} fallados\n`);
process.exit(fallados === 0 ? 0 : 1);
