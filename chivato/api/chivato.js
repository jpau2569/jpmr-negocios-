// ============================================================================
//  CHIVATO AI — análisis del cuadro de mandos por foto
// ----------------------------------------------------------------------------
//  Proxy seguro a la API de Claude: la clave vive en ANTHROPIC_API_KEY (Vercel
//  → Settings → Environment Variables) y el navegador nunca la ve.
//
//  Idea clave del diseño: **la IA solo identifica, no inventa**. Se le pasa el
//  catálogo de testigos de `datos/testigos.json` y se le pide que devuelva los
//  identificadores que reconoce en la foto. El significado, las causas, el
//  "qué hacer" y el coste salen siempre de nuestro catálogo revisado, no del
//  modelo — así ningún usuario recibe un presupuesto inventado.
//
//  Dos acciones:
//    POST { imagen, mime, vehiculo? }        → analiza la foto
//    POST { accion:"preguntar", pregunta, testigos[], vehiculo? } → seguimiento
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODELO = "claude-sonnet-5";
const MAX_BYTES = 5 * 1024 * 1024;            // 5 MB de imagen ya codificada
const MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const AQUI = dirname(fileURLToPath(import.meta.url));

let catalogoCache = null;
async function catalogo() {
  if (!catalogoCache) {
    const crudo = await readFile(join(AQUI, "..", "datos", "testigos.json"), "utf8");
    catalogoCache = JSON.parse(crudo);
  }
  return catalogoCache;
}

/** Lista compacta que se le pasa al modelo para que elija de ella. */
function listaParaModelo(doc) {
  return doc.testigos
    .map((t) => `${t.id} | ${t.nombre} | ${t.color} | ${t.forma}`)
    .join("\n");
}

const INSTRUCCIONES = `Eres el ojo de Chivato AI: identificas testigos encendidos en fotos del cuadro de mandos de un coche.

TU ÚNICA TAREA es DECIR QUÉ SE VE. No expliques averías, no des consejos y no estimes costes: de eso se encarga el catálogo de la aplicación.

Reglas:
1. Mira solo los testigos que estén ENCENDIDOS o PARPADEANDO. Ignora los símbolos apagados, serigrafiados o del sistema multimedia.
2. Para cada testigo encendido, elige el identificador de la lista de abajo que mejor lo describa. Usa el identificador EXACTO.
3. Si un testigo encendido no encaja con ninguno de la lista, NO lo fuerces: descríbelo en "no_identificados".
4. Los intermitentes verdes, las luces de cruce y demás avisos normales también cuentan: menciónalos, la app ya sabe que son informativos.
5. Si la foto está borrosa, oscura, lejos, o el cuadro está apagado (sin contacto), dilo en "calidad_foto" y "consejo_foto" y devuelve los testigos de los que estés razonablemente seguro.
6. Si la imagen no es un cuadro de mandos de un vehículo, devuelve la lista vacía y explícalo en "mensaje".
7. No inventes testigos "probables". Ante la duda, marca confianza "baja".

Responde ÚNICAMENTE con un objeto JSON, sin texto alrededor ni bloques de código, con este esquema exacto:
{
  "testigos": [
    { "id": "<identificador de la lista>", "estado": "fijo" | "parpadeando", "confianza": "alta" | "media" | "baja", "observacion": "<detalle breve de lo que ves, o cadena vacía>" }
  ],
  "no_identificados": [
    { "descripcion": "<qué dibujo se ve>", "color": "rojo" | "ambar" | "verde" | "azul" | "blanco" }
  ],
  "calidad_foto": "buena" | "justa" | "mala",
  "consejo_foto": "<cómo mejorar la foto, o cadena vacía>",
  "mensaje": "<solo si no hay nada que identificar, en español de España; si no, cadena vacía>",
  "lectura_extra": "<datos visibles útiles: kilometraje, temperatura exterior, nivel de combustible, mensajes de texto del cuadro. Cadena vacía si no hay>"
}

LISTA DE TESTIGOS (identificador | nombre | color | dibujo):
`;

/** Une lo que ha visto la IA con el texto revisado del catálogo. */
function componer(vision, doc) {
  const porId = new Map(doc.testigos.map((t) => [t.id, t]));
  const vistos = Array.isArray(vision?.testigos) ? vision.testigos : [];

  const detectados = [];
  const inventados = [];
  for (const v of vistos) {
    const ficha = porId.get(String(v?.id || "").trim());
    if (!ficha) { inventados.push(v?.id); continue; }
    if (detectados.some((d) => d.id === ficha.id)) continue;   // sin duplicados
    detectados.push({
      ...ficha,
      estado: v.estado === "parpadeando" ? "parpadeando" : "fijo",
      confianza: ["alta", "media", "baja"].includes(v.confianza) ? v.confianza : "media",
      observacion: String(v.observacion || "").slice(0, 300),
    });
  }

  // Primero lo más grave: rojo crítico → atención → informativo.
  const orden = { critico: 0, atencion: 1, informativo: 2 };
  detectados.sort((a, b) => orden[a.gravedad] - orden[b.gravedad]);

  return {
    testigos: detectados,
    no_identificados: (Array.isArray(vision?.no_identificados) ? vision.no_identificados : [])
      .slice(0, 5)
      .map((n) => ({
        descripcion: String(n?.descripcion || "").slice(0, 200),
        color: ["rojo", "ambar", "verde", "azul", "blanco"].includes(n?.color) ? n.color : "blanco",
      })),
    calidad_foto: ["buena", "justa", "mala"].includes(vision?.calidad_foto) ? vision.calidad_foto : "justa",
    consejo_foto: String(vision?.consejo_foto || "").slice(0, 300),
    mensaje: String(vision?.mensaje || "").slice(0, 500),
    lectura_extra: String(vision?.lectura_extra || "").slice(0, 300),
    ignorados: inventados.filter(Boolean).slice(0, 5),
  };
}

/** Saca el JSON de la respuesta aunque venga envuelto en ```json ... ```. */
function extraerJSON(texto) {
  const limpio = String(texto || "").trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try { return JSON.parse(limpio); } catch { /* seguimos probando */ }
  const desde = limpio.indexOf("{");
  const hasta = limpio.lastIndexOf("}");
  if (desde >= 0 && hasta > desde) {
    try { return JSON.parse(limpio.slice(desde, hasta + 1)); } catch { /* nada */ }
  }
  return null;
}

function descripcionVehiculo(v) {
  if (!v || typeof v !== "object") return "";
  const partes = [v.marca, v.modelo, v.ano, v.combustible]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(" ");
  return partes ? `\n\nDatos del vehículo que ha indicado el usuario: ${partes.slice(0, 120)}.` : "";
}

// ---------------------------------------------------------------------------
//  Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: "El análisis por IA no está configurado (falta ANTHROPIC_API_KEY en Vercel). El catálogo de testigos sigue funcionando sin conexión.",
      sin_ia: true,
    });
  }

  const cuerpo = req.body ?? {};
  const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const doc = await catalogo();

  try {
    // ---- Seguimiento: preguntas sobre lo ya detectado --------------------
    if (cuerpo.accion === "preguntar") {
      const pregunta = String(cuerpo.pregunta || "").trim().slice(0, 600);
      if (!pregunta) return res.status(400).json({ error: "Falta la pregunta." });

      const contexto = (Array.isArray(cuerpo.testigos) ? cuerpo.testigos : [])
        .slice(0, 8)
        .map((id) => doc.testigos.find((t) => t.id === id))
        .filter(Boolean)
        .map((t) => `- ${t.nombre} (${t.color}, ${t.gravedad}): ${t.significado} Qué hacer: ${t.que_hacer}`)
        .join("\n");

      const respuesta = await cliente.messages.create({
        model: MODELO,
        max_tokens: 700,
        system:
          `Eres Chivato AI, un mecánico de confianza que habla en español de España, claro y sin jerga. ` +
          `Respondes dudas sobre los testigos que el conductor acaba de ver en su cuadro de mandos.\n\n` +
          `Reglas: sé breve (máximo 6 frases). No inventes precios cerrados ni diagnósticos definitivos: ` +
          `sin ver el coche solo se puede orientar. Si la situación es peligrosa (frenos, temperatura, ` +
          `presión de aceite, airbag, dirección), dilo claramente y recomienda parar. Recuerda al final, ` +
          `solo si viene a cuento, que esto no sustituye a un taller.\n\n` +
          `Testigos detectados en la foto:\n${contexto || "(ninguno identificado)"}` +
          descripcionVehiculo(cuerpo.vehiculo),
        messages: [{ role: "user", content: pregunta }],
      });

      const texto = respuesta.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ respuesta: texto || "No he sabido responder a eso. Prueba a preguntarlo de otra forma." });
    }

    // ---- Análisis de la foto ---------------------------------------------
    const mime = MIMES.includes(cuerpo.mime) ? cuerpo.mime : "image/jpeg";
    const datos = String(cuerpo.imagen || "").replace(/^data:[^,]+,/, "");
    if (!datos) return res.status(400).json({ error: "No ha llegado ninguna imagen." });
    if (datos.length > MAX_BYTES) {
      return res.status(413).json({ error: "La foto pesa demasiado. Hazla de nuevo desde la app, que la comprime sola." });
    }

    const respuesta = await cliente.messages.create({
      model: MODELO,
      max_tokens: 1500,
      system: INSTRUCCIONES + listaParaModelo(doc) + descripcionVehiculo(cuerpo.vehiculo),
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: datos } },
          { type: "text", text: "Analiza esta foto del cuadro de mandos y responde solo con el JSON." },
        ],
      }],
    });

    const texto = respuesta.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const vision = extraerJSON(texto);
    if (!vision) {
      return res.status(502).json({ error: "La IA no ha devuelto un resultado legible. Vuelve a intentarlo." });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ...componer(vision, doc), version_catalogo: doc.version });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "La clave ANTHROPIC_API_KEY no es válida. Revísala en Vercel → Settings → Environment Variables." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Demasiadas peticiones seguidas. Espera unos segundos y vuelve a intentarlo." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Error de la API de Claude en /api/chivato:", err.status, err.message);
      return res.status(502).json({ error: `La IA ha devuelto un error (${err.status}). Inténtalo de nuevo en un momento.` });
    }
    console.error("Error interno en /api/chivato:", err);
    return res.status(500).json({ error: "Error interno al analizar la foto." });
  }
}
