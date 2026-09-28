// ============================================================================
//  Tests de Fotos para Idealista — npm test
//  Funciones puras (orden, nombres, dHash, retoque, duplicados, normalización)
//  y el endpoint /api/fotos-idealista con la red de Anthropic simulada.
// ============================================================================

import { readFile } from "node:fs/promises";
import * as C from "../fotos-idealista/catalogo.js";
import * as L from "../lib/fotos-idealista.js";
import { parejasParecidas, agrupar, propuestaDuplicados } from "../fotos-idealista/duplicados.js";
import * as P from "../fotos-idealista/procesar.js";
import { avisosFoto, htmlFoto, htmlEstadoIA, enumerar, esc } from "../fotos-idealista/interfaz.js";
import handler, { validarFotos } from "../api/_fotos-idealista.js";
import { rutasDisponibles } from "../api/[ruta].js";

let pasados = 0, fallados = 0;
function check(nombre, cond, detalle = "") {
  if (cond) { pasados++; console.log(`  ✅ ${nombre}`); }
  else { fallados++; console.error(`  ❌ ${nombre}${detalle ? " — " + detalle : ""}`); }
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n📚 Catálogos");
check("lib/fotos-idealista.js reexporta el módulo de la app", L.ordenarParaIdealista === C.ordenarParaIdealista && L.ESTANCIAS === C.ESTANCIAS);
check("18 estancias, 15 objetos y 6 avisos", C.ESTANCIAS.length === 18 && C.OBJETOS.length === 15 && C.AVISOS.length === 6);
const ids = (l) => l.map((x) => x.id);
check("ids de estancia sin repetir", new Set(ids(C.ESTANCIAS)).size === C.ESTANCIAS.length);
check("todas las estancias pedidas están", ["salon", "cocina", "dormitorio", "dormitorio_principal", "bano", "aseo", "terraza", "balcon", "fachada", "vistas", "pasillo", "recibidor", "trastero", "garaje", "jardin", "bajo_cubierta", "zona_comun", "otro"].every((i) => C.estancia(i)));
check("los trozos de nombre de archivo no llevan tildes ni espacios", C.ESTANCIAS.every((e) => /^[a-z0-9-]+$/.test(e.archivo)));
check("la herramienta de Claude usa los mismos enums que el catálogo",
  JSON.stringify(C.HERRAMIENTA_FOTOS.input_schema.properties.fotos.items.properties.estancia.enum) === JSON.stringify(ids(C.ESTANCIAS)) &&
  C.HERRAMIENTA_FOTOS.input_schema.properties.fotos.items.properties.objetos_a_retirar.items.enum.length === 15);
check("/api/fotos-idealista está registrada en el enrutador", rutasDisponibles.includes("fotos-idealista"));
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
check("vercel.json incluye fotos-idealista/*.js en la función", vercel.functions["api/[ruta].js"].includeFiles.includes("fotos-idealista/"));

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n🧹 normalizarRespuestaIA — solo pasa lo del catálogo");
const bruto = {
  fotos: [
    { foto: 2, estancia: "cocina", calidad: { luz: 5, encuadre: 4, nitidez: 9 }, objetos_a_retirar: ["movil", "gato", "mandos", "movil"], avisos: ["foto_oscura", "fantasma"], es_portada_candidata: true },
    { foto: 1, estancia: "sotano_secreto", calidad: { luz: "x" }, objetos_a_retirar: "movil", avisos: null, es_portada_candidata: "sí" },
    { foto: 2, estancia: "salon" },                              // repetida: se ignora
    { foto: 7, estancia: "salon" },                              // fuera de rango
    { foto: 0, estancia: "salon" },
  ],
};
const norm = C.normalizarRespuestaIA(bruto, 3);
check("una entrada por foto enviada (null si falta)", norm.fotos.length === 3 && norm.fotos[2] === null);
check("la foto 2 queda como cocina", norm.fotos[1].estancia === "cocina");
check("objetos inventados fuera y sin repetidos", JSON.stringify(norm.fotos[1].objetos_a_retirar) === '["movil","mandos"]');
check("avisos inventados fuera", JSON.stringify(norm.fotos[1].avisos) === '["foto_oscura"]');
check("calidad acotada a 1-5 y con media", norm.fotos[1].calidad.nitidez === 5 && norm.fotos[1].calidad.media === 4.7);
check("estancia inventada → otro", norm.fotos[0].estancia === "otro");
check("calidad ilegible → 3", norm.fotos[0].calidad.luz === 3 && norm.fotos[0].calidad.encuadre === 3);
check("objetos que no son lista → vacío", norm.fotos[0].objetos_a_retirar.length === 0 && norm.fotos[0].avisos.length === 0);
check("es_portada_candidata solo si es true de verdad", norm.fotos[0].es_portada_candidata === false && norm.fotos[1].es_portada_candidata === true);
check("se apuntan los ids ignorados", ["gato", "fantasma", "sotano_secreto"].every((x) => norm.ignorados.includes(x)));
check("la primera respuesta de una foto es la que vale (no la repetida)", norm.fotos[1].estancia === "cocina");
check("entrada basura no rompe", C.normalizarRespuestaIA(null, 2).fotos.every((f) => f === null) && C.normalizarRespuestaIA({ fotos: "x" }, -1).fotos.length === 0);

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n🔢 Orden recomendado para Idealista");
const cal = (m, luz = m) => ({ luz, encuadre: m, nitidez: m, media: m });
const fotos = [
  { id: "a", estancia: "bano", calidad: cal(4) },
  { id: "b", estancia: "vistas", calidad: cal(5), es_portada_candidata: true },
  { id: "c", estancia: "dormitorio", calidad: cal(3) },
  { id: "d", estancia: "salon", calidad: cal(3) },
  { id: "e", estancia: "cocina", calidad: cal(5), es_portada_candidata: true },
  { id: "f", estancia: "dormitorio_principal", calidad: cal(4) },
  { id: "g", estancia: "terraza", calidad: cal(4) },
  { id: "h", estancia: "salon", calidad: cal(4) },
  { id: "i", estancia: "zona_comun", calidad: cal(4) },
  { id: "j", estancia: "trastero", calidad: cal(3) },
  { id: "k", estancia: "dormitorio", calidad: cal(5), descartada: true },
];
const orden = C.ordenarParaIdealista(fotos);
check("portada: la cocina luminosa candidata (no las vistas)", orden[0] === "e", orden.join(","));
check("después salón (el mejor primero), dorm. principal, dormitorio, baño, terraza, resto",
  orden.join(",") === "e,h,d,f,c,a,g,j,b,i", orden.join(","));
check("vistas y zona común al final", orden.slice(-2).join(",") === "b,i");
check("las descartadas no entran", !orden.includes("k") && orden.length === 10);
check("sin IA: portada = primer salón, y el resto por estancia manteniendo el orden de Pau",
  C.ordenarParaIdealista([{ id: "1", estancia: "cocina" }, { id: "2", estancia: "salon" }, { id: "3", estancia: null }, { id: "4", estancia: "salon" }]).join(",") === "2,4,1,3");
check("solo vistas: la portada sale igualmente", C.ordenarParaIdealista([{ id: "v", estancia: "vistas" }, { id: "z", estancia: "zona_comun" }])[0] === "v");
check("un aviso resta a la hora de elegir portada",
  C.elegirPortada([{ id: "x", estancia: "salon", calidad: cal(4), avisos: ["foto_oscura"] }, { id: "y", estancia: "salon", calidad: cal(4) }]) === "y");
check("lista vacía → []", C.ordenarParaIdealista([]).length === 0 && C.elegirPortada([]) === null);

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n🏷️  Nombres de archivo");
const n1 = C.nombresArchivo(["cocina", "dormitorio_principal", "dormitorio", "dormitorio", "bano", "bano", null, "zona_comun"]);
check("01-cocina, 02-dormitorio-principal, 03-dormitorio-2…", n1.join(" ") ===
  "01-cocina.jpg 02-dormitorio-principal.jpg 03-dormitorio-2.jpg 04-dormitorio-3.jpg 05-bano.jpg 06-bano-2.jpg 07-foto.jpg 08-zona-comun.jpg", n1.join(" "));
check("sin dormitorio principal el primero es «dormitorio»", C.nombresArchivo(["dormitorio", "dormitorio"]).join(" ") === "01-dormitorio.jpg 02-dormitorio-2.jpg");
check("con 100 fotos o más, tres cifras", C.nombresArchivo(Array(100).fill("salon"))[0] === "001-salon.jpg");
check("sin tildes ni caracteres raros", C.sinTildes("Uría 12, 3ºB · Oviedo!") === "uria-12-3b-oviedo");
check("ZIP con referencia antepuesta", C.nombreZip("Uría 12 3ºB") === "uria-12-3b-fotos-idealista.zip" && C.nombreZip("  ") === "fotos-idealista.zip");
check("una referencia maliciosa no sale del nombre", !/[/\\.]/.test(C.nombreZip("../../etc/passwd").replace(/\.zip$/, "")));

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n🧬 dHash, Hamming y repetidas");
const rampa = Array.from({ length: 72 }, (_, i) => (i % 9) * 20);           // crece a la derecha → todo ceros
check("dHash de una rampa creciente = 0000…", C.dHashDesdeGris(rampa) === "0000000000000000");
check("dHash de una rampa decreciente = ffff…", C.dHashDesdeGris(rampa.map((v) => 255 - v)) === "ffffffffffffffff");
let lanza = false; try { C.dHashDesdeGris([1, 2, 3]); } catch { lanza = true; }
check("dHash exige 72 valores", lanza);
check("Hamming: iguales 0, opuestos 64, un bit 1",
  C.hammingDHash("0f0f0f0f0f0f0f0f", "0f0f0f0f0f0f0f0f") === 0 &&
  C.hammingDHash("0000000000000000", "ffffffffffffffff") === 64 &&
  C.hammingDHash("0000000000000000", "0000000000000100") === 1);
check("Hamming con un hash inválido = 64 (nunca «parecidas»)", C.hammingDHash("zz", "0000000000000000") === 64);
const hs = ["0000000000000000", "0000000000000007", "ffffffffffffffff", "00000000000000ff", "fffffffffffffff0"];
const par = parejasParecidas(hs);
check("parejas por debajo del umbral 10", par.some((p) => p.a === 0 && p.b === 1 && p.distancia === 3) && !par.some((p) => p.a === 0 && p.b === 2));
check("agrupa en cadena (A≈B, B≈D)", agrupar(par, hs.length).some((g) => g.includes(0) && g.includes(1) && g.includes(3)));
const prop = propuestaDuplicados([
  { hash: hs[0], nitidez: 100, ancho: 2560, alto: 1920 },
  { hash: hs[1], nitidez: 300, ancho: 2560, alto: 1920 },
  { hash: hs[2], nitidez: 50, ancho: 2560, alto: 1920 },
  { hash: "8000000000000000", nitidez: 105, ancho: 1280, alto: 960 },
]);
check("de las repetidas se queda la más nítida", prop.length === 1 && prop[0].quedarse === 1 && prop[0].quitar.sort().join(",") === "0,3");
const empate = propuestaDuplicados([{ hash: hs[0], nitidez: 100, ancho: 1280, alto: 960 }, { hash: hs[0], nitidez: 104, ancho: 2560, alto: 1920 }]);
check("si la nitidez casi empata, gana la de más resolución", empate[0].quedarse === 1);
check("sin repetidas, sin propuesta", propuestaDuplicados([{ hash: hs[0] }, { hash: hs[2] }]).length === 0);

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n🎨 Retoque suave y utilidades de imagen");
check("medidas: 4284×5712 → 1920×2560", JSON.stringify(P.medidasSalida(4284, 5712, 2560)) === '{"ancho":1920,"alto":2560}');
check("medidas: nunca amplía", JSON.stringify(P.medidasSalida(800, 600, 2560)) === '{"ancho":800,"alto":600}');
const img = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) { const [r, g, b] = f(i % w, (i / w) | 0); d.set([r, g, b, 255], i * 4); } return { data: d, width: w, height: h }; };
const gris = img(64, 64, (x) => [40 + x * 2, 40 + x * 2, 40 + x * 2]);   // 40…166: foto apagada
const hist = P.histogramaLuminancia(gris.data);
check("histograma cuenta todos los píxeles", hist.reduce((a, b) => a + b, 0) === 64 * 64);
const niv = P.nivelesAutocontraste(hist);
check("niveles detecta negro y blanco de la foto", niv.negro >= 40 && niv.negro <= 42 && niv.blanco >= 164 && niv.blanco <= 166, JSON.stringify(niv));
const tabla = P.tablaRetoque(hist);
check("autocontraste ligero: el negro no pasa de 24 → un gris 40 no se vuelve negro puro", tabla[40] > 20);
check("el retoque aclara un poco los medios", tabla[128] > 128 && tabla[128] < 150, String(tabla[128]));
check("la tabla es creciente (no invierte tonos)", tabla.every((v, i) => i === 0 || v >= tabla[i - 1]));
const plano = P.tablaRetoque(P.histogramaLuminancia(img(8, 8, () => [128, 128, 128]).data));
check("una foto plana no se fuerza (sin división por cero)", plano.every(Number.isFinite) && Math.abs(plano[128] - 128) < 20);
const color = img(4, 4, () => [200, 100, 50]);
P.aplicarTablaYSaturacion(color.data, Uint8ClampedArray.from({ length: 256 }, (_, i) => i), 0.04);
check("saturación +4 %: el rojo sube un poco y el azul baja un poco", color.data[0] > 200 && color.data[0] < 210 && color.data[2] < 50 && color.data[2] > 40);
const borde = img(16, 16, (x) => (x < 8 ? [60, 60, 60] : [180, 180, 180]));
const antes = borde.data[(8 * 16 + 7) * 4];
P.enfocar(borde.data, 16, 16);
check("el enfoque marca un poco más los bordes", borde.data[(8 * 16 + 7) * 4] < antes && borde.data[(8 * 16 + 8) * 4] > 180);
check("el enfoque no toca las zonas lisas", borde.data[(8 * 16 + 2) * 4] === 60);
const r = P.retocar(img(32, 32, (x, y) => [x * 6, y * 6, 100]));
check("retocar devuelve el mismo ImageData con valores válidos", r.data.length === 32 * 32 * 4 && r.data[3] === 255);
const ruido = img(32, 32, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]));
const liso = img(32, 32, () => [128, 128, 128]);
check("nitidez: un patrón fino es más nítido que un gris liso",
  P.nitidez(P.aGris(ruido.data), 32, 32) > P.nitidez(P.aGris(liso.data), 32, 32) && P.nitidez(P.aGris(liso.data), 32, 32) === 0);
const cab = (t) => Uint8Array.from([0, 0, 0, 24, ...[...t].map((c) => c.charCodeAt(0))]);
check("HEIC por cabecera (ftypheic / ftypmif1)", P.esHeic(cab("ftypheic")) && P.esHeic(cab("ftypmif1")));
check("HEIC por tipo o extensión", P.esHeic(null, "IMG_1234.HEIC", "") && P.esHeic(null, "x", "image/heif"));
check("un JPEG no es HEIC", !P.esHeic(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), "a.jpg", "image/jpeg"));
const conExif = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0, 8, 69, 120, 105, 102, 0, 0, 0xff, 0xda]);
const sinExif = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 6, 74, 70, 73, 70, 0xff, 0xda]);
check("tieneExif detecta el bloque EXIF y su ausencia", P.tieneExif(conExif) && !P.tieneExif(sinExif) && !P.tieneExif(new Uint8Array(2)));

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n🖼️  Textos de la interfaz (salen del catálogo)");
const f1 = { id: "f1", estancia: "cocina", vistaUrl: "blob:x", ia: { objetos_a_retirar: ["movil", "mandos", "ropa"], avisos: ["posible_otro_inmueble"], calidad: cal(4) }, parecidaA: "f9" };
const av = avisosFoto(f1, { posicionDe: (id) => (id === "f9" ? 5 : 0) });
check("«Retira: móvil, mandos a distancia y ropa.»", av.some((a) => a.texto === "Retira: móvil, mandos a distancia y ropa." && a.borrar));
check("«Puede ser de otro inmueble» marcado como grave", av.some((a) => a.tipo === "grave" && a.texto.startsWith("Puede ser de otro inmueble")));
check("«Parecida a la foto 5»", av.some((a) => a.texto === "Parecida a la foto 5."));
check("sin estancia pide elegirla", avisosFoto({ estancia: null }).some((a) => a.texto.includes("Elige")));
const h = htmlFoto({ ...f1, id: 'x"><script>' }, 1, 3, "01-cocina.jpg", { posicionDe: () => 5 });
check("la tarjeta enlaza a /marcadeagua.html para borrar objetos", h.includes('href="/marcadeagua.html"'));
check("la tarjeta escapa el HTML", !h.includes("<script>") && h.includes("&lt;script&gt;"));
check("la primera foto lleva el sello de portada y ↑ desactivado", h.includes("Portada") && /data-accion="subir"[^>]*disabled/.test(h));
check("enumerar y esc", enumerar(["a"]) === "a" && enumerar(["a", "b", "c"]) === "a, b y c" && esc("<&>") === "&lt;&amp;&gt;");
check("estado de la IA con error explica que sigue funcionando", htmlEstadoIA({ estado: "error", mensaje: "sin red." }).includes("sigue funcionando"));

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n🌐 /api/fotos-idealista");
const ENV = ["ANTHROPIC_API_KEY", "CEREBRO_CLAVE", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
const envOriginal = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
for (const k of ENV) delete process.env[k];
const resMock = () => { const r = { code: 0, body: null }; return { r, status(c) { r.code = c; return this; }, json(b) { r.body = b; return this; }, setHeader() {} }; };
const pide = async (body, method = "POST") => { const rr = resMock(); await handler({ method, body }, rr); return rr.r; };
const foto = { data: "/9j/4AAQSkZJRgABAQ==", media_type: "image/jpeg" };

let res = await pide({}, "GET");
check("solo POST", res.code === 405);
res = await pide({ fotos: [foto] });
check("sin ANTHROPIC_API_KEY → 503 con sin_ia (la app sigue sin IA)", res.code === 503 && res.body.sin_ia === true);
process.env.ANTHROPIC_API_KEY = "sk-ant-prueba";
check("validación: sin fotos → 400", validarFotos([]).codigo === 400 && validarFotos("x").codigo === 400);
check("validación: más de 20 → 413", validarFotos(Array(21).fill(foto)).codigo === 413);
check("validación: tipo no permitido → 400", validarFotos([{ ...foto, media_type: "image/svg+xml" }]).codigo === 400);
check("validación: base64 con basura → 400", validarFotos([{ ...foto, data: "abc<script>" }]).codigo === 400);
check("validación: una foto enorme → 413", validarFotos([{ ...foto, data: "A".repeat(C.MAX_B64_FOTO + 4) }]).codigo === 413);
check("validación: el total por encima del límite de Vercel → 413", validarFotos(Array(7).fill({ ...foto, data: "A".repeat(550_000) })).codigo === 413);
res = await pide({ fotos: [foto] });
check("sin Supabase ni CEREBRO_CLAVE no gasta crédito (503)", res.code === 503 && /CEREBRO_CLAVE/.test(res.body.error));
process.env.CEREBRO_CLAVE = "secreta";
res = await pide({ fotos: [foto], clave: "mala" });
check("clave incorrecta → 401", res.code === 401);

const realFetch = globalThis.fetch;
const llamadas = [];
let respuesta = () => ({ type: "tool_use", id: "t1", name: "clasificar_fotos", input: {
  fotos: [
    { foto: 1, estancia: "salon", calidad: { luz: 5, encuadre: 5, nitidez: 4 }, objetos_a_retirar: ["mandos", "dron"], avisos: [], es_portada_candidata: true },
    { foto: 2, estancia: "cocina_de_lujo", calidad: { luz: 2, encuadre: 3, nitidez: 3 }, objetos_a_retirar: [], avisos: ["posible_otro_inmueble"], es_portada_candidata: false },
  ],
} });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.includes("anthropic.com")) throw new Error("fetch inesperado " + u);
  const body = JSON.parse(init.body);
  llamadas.push(body);
  const bloque = respuesta(body);
  if (bloque.status) return new Response(JSON.stringify({ type: "error", error: { type: "api_error", message: "caído" } }), { status: bloque.status, headers: { "content-type": "application/json" } });
  return new Response(JSON.stringify({ id: "m", type: "message", role: "assistant", model: "claude-sonnet-5", stop_reason: "tool_use", usage: { input_tokens: 1, output_tokens: 1 }, content: [bloque] }), { status: 200, headers: { "content-type": "application/json" } });
};
try {
  res = await pide({ fotos: [foto, { ...foto, media_type: "image/webp" }], clave: "secreta" });
  check("con clave buena → 200", res.code === 200 && res.body.ok === true, JSON.stringify(res.body));
  const pet = llamadas.at(-1);
  check("herramienta forzada clasificar_fotos", pet.tool_choice?.type === "tool" && pet.tool_choice.name === "clasificar_fotos" && pet.tools[0].name === "clasificar_fotos");
  check("usa el modelo del resto del repo", pet.model === "claude-sonnet-5");
  const imgs = pet.messages[0].content.filter((b) => b.type === "image");
  check("manda todas las fotos juntas, etiquetadas «Foto N»", imgs.length === 2 && pet.messages[0].content.some((b) => b.type === "text" && b.text === "Foto 2") && imgs[1].source.media_type === "image/webp");
  check("el system prompt lleva el catálogo cerrado", pet.system.includes("dormitorio_principal") && pet.system.includes("posible_otro_inmueble"));
  check("la respuesta sale normalizada: objeto inventado fuera", JSON.stringify(res.body.fotos[0].objetos_a_retirar) === '["mandos"]' && res.body.ignorados.includes("dron"));
  check("estancia inventada → otro, aviso de otro inmueble conservado", res.body.fotos[1].estancia === "otro" && res.body.fotos[1].avisos[0] === "posible_otro_inmueble");
  check("la respuesta no trae textos de la IA, solo ids", !JSON.stringify(res.body).includes("Salón"));

  respuesta = () => ({ type: "text", text: "no me apetece" });
  res = await pide({ fotos: [foto], clave: "secreta" });
  check("sin tool_use → 502 con mensaje claro", res.code === 502 && /estancias/.test(res.body.error));

  respuesta = () => ({ status: 500 });
  res = await pide({ fotos: [foto], clave: "secreta" });
  check("la API de Claude cae → 502 y la app sigue", res.code === 502 && /seguir/.test(res.body.error));
} finally {
  globalThis.fetch = realFetch;
  for (const k of ENV) { if (envOriginal[k] === undefined) delete process.env[k]; else process.env[k] = envOriginal[k]; }
}

// ═════════════════════════════════════════════════════════════════════════════
console.log("\n📦 ZIP y enlace corto");
const [zipA, zipB] = await Promise.all([
  readFile(new URL("../fotos-idealista/zip.js", import.meta.url), "utf8"),
  readFile(new URL("../escaparate3d-pro/js/zip.js", import.meta.url), "utf8"),
]);
check("fotos-idealista/zip.js sigue siendo copia exacta de escaparate3d-pro/js/zip.js", zipA === zipB);
const corto = await readFile(new URL("../fotos-idealista.html", import.meta.url), "utf8");
check("fotos-idealista.html lleva a la app", corto.includes("/fotos-idealista/app.html"));
const html = await readFile(new URL("../fotos-idealista/app.html", import.meta.url), "utf8");
check("la app avisa de «sin ubicación GPS»", html.includes("sin ubicación GPS"));
const cargar = await readFile(new URL("../fotos-idealista/cargar.js", import.meta.url), "utf8");
check("heic2any solo desde cdn.jsdelivr.net y con huella SRI", /https:\/\/cdn\.jsdelivr\.net\/npm\/heic2any@0\.0\.4\//.test(cargar) && /sha384-[A-Za-z0-9+/=]{64}/.test(cargar));
check("se respeta la orientación EXIF (imageOrientation: from-image)", cargar.includes('imageOrientation: "from-image"'));

console.log(`\n${fallados === 0 ? "✅" : "❌"} Fotos para Idealista: ${pasados} pasados, ${fallados} fallados\n`);
process.exit(fallados === 0 ? 0 : 1);
