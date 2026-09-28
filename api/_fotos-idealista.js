// ============================================================================
//  /api/fotos-idealista — la IA mira las fotos del piso (Claude visión)
// ----------------------------------------------------------------------------
//  Recibe hasta 20 miniaturas (≤ 768 px, JPEG en base64) de un mismo inmueble
//  y devuelve, por foto, SOLO identificadores del catálogo cerrado de
//  fotos-idealista/catalogo.js: estancia, calidad 1-5, objetos a retirar,
//  avisos y si vale de portada. Los textos que ve Pau salen del catálogo, no
//  del modelo, y cualquier identificador inventado se descarta aquí.
//
//  Las fotos se mandan todas juntas en una sola petición para que la IA pueda
//  notar si alguna parece de otro inmueble.
//
//  Protección: gasta crédito de la API, así que exige la clave de
//  sincronización (la misma de Clara y Cerebro) con `autoriza` de Cerebro.
//  Sin ANTHROPIC_API_KEY responde 503 con `sin_ia: true` y la app sigue sin IA.
//
//  POST { fotos: [{ data: "<base64>", media_type: "image/jpeg" }], clave }
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { autoriza } from "./_cerebro.js";
import {
  ESTANCIAS, OBJETOS, AVISOS, HERRAMIENTA_FOTOS, MAX_FOTOS_IA, MAX_B64_FOTO, MAX_B64_PETICION,
  normalizarRespuestaIA,
} from "../fotos-idealista/catalogo.js";

const MODEL = "claude-sonnet-5";
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const lista = (cat, campo) => cat.map((x) => `${x.id} (${x[campo]})`).join(", ");

const INSTRUCCIONES =
  "Ayudas a un agente inmobiliario de Asturias a preparar las fotos de UN piso para el portal Idealista. " +
  "Recibes varias fotos numeradas («Foto 1», «Foto 2»…) del mismo inmueble. Para CADA foto devuelve, usando solo los identificadores permitidos:\n" +
  "- estancia: qué estancia se ve. Si hay varias habitaciones, la mayor o mejor equipada es dormitorio_principal y las demás dormitorio. Si dudas, otro.\n" +
  "- calidad: luz, encuadre y nitidez de 1 (mala) a 5 (excelente).\n" +
  "- objetos_a_retirar: solo objetos que se ven claramente y conviene quitar antes de repetir la foto. Si no hay, lista vacía.\n" +
  "- avisos: solo si se cumplen de verdad. posible_otro_inmueble cuando, comparando con las demás fotos (suelos, puertas, carpinterías, estilo), esa foto no encaja con el resto.\n" +
  "- es_portada_candidata: true solo para las 1-3 fotos que mejor venderían el piso como primera imagen (luminosas, amplias, bien encuadradas).\n" +
  "No describas las fotos ni inventes nada: solo clasificas.\n\n" +
  `Estancias: ${lista(ESTANCIAS, "nombre")}.\n` +
  `Objetos: ${lista(OBJETOS, "nombre")}.\n` +
  `Avisos: ${lista(AVISOS, "texto")}.`;

/** Valida las fotos recibidas. Devuelve { fotos } o { error, codigo }. */
export function validarFotos(fotos) {
  if (!Array.isArray(fotos) || fotos.length === 0) return { codigo: 400, error: "No ha llegado ninguna foto." };
  if (fotos.length > MAX_FOTOS_IA) return { codigo: 413, error: `Como mucho ${MAX_FOTOS_IA} fotos por envío.` };
  let total = 0;
  const limpias = [];
  for (const f of fotos) {
    const data = typeof f?.data === "string" ? f.data : "";
    const tipo = TIPOS.includes(f?.media_type) ? f.media_type : null;
    if (!tipo || !data || !BASE64.test(data)) return { codigo: 400, error: "Alguna foto no es una imagen JPG, PNG o WebP válida." };
    if (data.length > MAX_B64_FOTO) return { codigo: 413, error: "Alguna foto es demasiado grande: la app debe mandarla reducida." };
    total += data.length;
    limpias.push({ data, media_type: tipo });
  }
  if (total > MAX_B64_PETICION) return { codigo: 413, error: "Demasiadas fotos juntas: mándalas en varios envíos." };
  return { fotos: limpias };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      sin_ia: true,
      error: "La IA no está configurada (falta ANTHROPIC_API_KEY en Vercel). Puedes poner tú la estancia de cada foto.",
    });
  }

  const cuerpo = req.body && typeof req.body === "object" ? req.body : {};
  const v = validarFotos(cuerpo.fotos);
  if (v.error) return res.status(v.codigo).json({ error: v.error });

  const no = await autoriza(cuerpo.clave, "usar la IA con las fotos");
  if (no) return res.status(no.codigo).json({ error: no.error });

  const contenido = [];
  v.fotos.forEach((f, i) => {
    contenido.push({ type: "text", text: `Foto ${i + 1}` });
    contenido.push({ type: "image", source: { type: "base64", media_type: f.media_type, data: f.data } });
  });
  contenido.push({ type: "text", text: `Clasifica las ${v.fotos.length} fotos con la herramienta clasificar_fotos.` });

  try {
    const cliente = new Anthropic();
    const r = await cliente.messages.create({
      model: MODEL,
      max_tokens: 400 + 180 * v.fotos.length,
      system: INSTRUCCIONES,
      tools: [HERRAMIENTA_FOTOS],
      tool_choice: { type: "tool", name: HERRAMIENTA_FOTOS.name },
      messages: [{ role: "user", content: contenido }],
    });
    const uso = r.content.find((b) => b.type === "tool_use" && b.name === HERRAMIENTA_FOTOS.name);
    if (!uso) return res.status(502).json({ error: "La IA no ha devuelto un resultado legible. Pon tú las estancias o vuelve a intentarlo." });
    const limpio = normalizarRespuestaIA(uso.input, v.fotos.length);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, ...limpio });
  } catch (e) {
    console.error("Error de la IA en /api/fotos-idealista:", e?.status, e?.message);
    if (e?.status === 401) return res.status(500).json({ error: "La clave ANTHROPIC_API_KEY no es válida. Revísala en Vercel." });
    if (e?.status === 429) return res.status(429).json({ error: "Demasiadas peticiones seguidas. Espera un poco y vuelve a intentarlo." });
    return res.status(502).json({ error: "La IA ha fallado. Puedes seguir poniendo tú la estancia de cada foto." });
  }
}
