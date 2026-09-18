// ============================================================================
//  CASTRESANA LUXURY MOTION — generador de campañas de vídeo inmobiliario
// ----------------------------------------------------------------------------
//  Proxy seguro sobre la API de Claude: la clave vive en ANTHROPIC_API_KEY
//  (Vercel → Settings → Environment Variables) y el navegador nunca la ve.
//
//  Dos motores, misma respuesta:
//    · "ia"      → Claude, con el prompt maestro canónico de
//                  agentes/luxury-motion.md (va en el bundle por includeFiles).
//    · "estudio" → componerCampana() de lib/luxury-motion.js, sin IA.
//
//  El modo estudio NO es un mensaje de error: es una campaña completa y
//  utilizable. Se usa cuando no hay clave, cuando el usuario lo pide o cuando
//  la API falla, de modo que la herramienta nunca deja a Pau sin campaña.
//  Como en Chivato, lo que falta se avisa; no se inventa.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  normalizarBriefing,
  componerCampana,
  campanaATexto,
  fichaDelInmueble,
  notasDeHonestidad,
  NEGATIVE_PROMPT,
  NEGATIVE_PROMPT_EN,
} from "../lib/luxury-motion.js";

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 8000;

// El prompt maestro se cachea en memoria entre invocaciones de la función.
let cachePrompt = null;
function promptMaestro() {
  if (cachePrompt === null) {
    cachePrompt = readFileSync(path.join(process.cwd(), "agentes", "luxury-motion.md"), "utf8");
  }
  return cachePrompt;
}

// ---------------------------------------------------------------------------
//  Briefing → mensaje para el modelo. Solo datos reales, nada implícito.
// ---------------------------------------------------------------------------
export function briefingParaModelo(b) {
  const L = [];
  L.push("BRIEFING DEL INMUEBLE (datos reales; lo que no aparezca aquí NO existe):");
  L.push(`- Referencia: ${b.referencia || "no indicada"}`);
  L.push(`- Tipo: ${b.tipo.nombre}`);
  L.push(`- Localización: ${b.localizacion}`);
  L.push(`- Precio: ${b.precio || "NO INDICADO — no lo menciones"}`);
  L.push(`- Superficie: ${b.metros ? `${b.metros} m²` : "NO INDICADA — no la menciones"}`);
  L.push(`- Habitaciones: ${b.habitaciones ?? "NO INDICADAS — no las menciones"}`);
  L.push(`- Baños: ${b.banos ?? "NO INDICADOS — no los menciones"}`);
  L.push(
    `- Características marcadas: ${
      b.caracteristicas.length
        ? b.caracteristicas.map((c) => c.nombre).join(", ")
        : "NINGUNA — no prometas terraza, vistas, piscina ni nada parecido"
    }`
  );
  L.push("");
  L.push("ENCARGO:");
  L.push(`- Cliente objetivo: ${b.cliente.nombre} — ${b.cliente.perfil} Busca: ${b.cliente.deseo}. Tono: ${b.cliente.tono}.`);
  L.push(`- Objetivo del vídeo: ${b.objetivo.nombre} — ${b.objetivo.foco}. CTA: "${b.objetivo.cta}".`);
  L.push(`- Plataforma: ${b.plataforma.nombre} (${b.plataforma.ratio}). Ritmo: ${b.plataforma.ritmo}. Encuadre seguro: ${b.plataforma.seguridad}.`);
  L.push(`- Duración: ${b.duracion.segundos} segundos, en torno a ${b.duracion.escenas} escenas.`);
  L.push(`- Estilo creativo: ${b.estilo.nombre}. Luz: ${b.estilo.luz}. Atmósfera: ${b.estilo.atmosfera}. Óptica: ${b.estilo.lente}. Paleta: ${b.estilo.paleta}. Ritmo: ${b.estilo.ritmo}.`);
  L.push(`- Generador de vídeo: ${b.generador.nombre}. ${b.generador.guia}`);
  if (b.variante > 0) {
    L.push(
      `- Es la versión número ${b.variante + 1} de esta misma campaña: cambia el ángulo creativo, el eslogan y la apertura respecto a una versión anterior. Los datos del inmueble siguen siendo los mismos.`
    );
  }
  L.push("");
  L.push("Devuelve únicamente el objeto JSON del formato de respuesta.");
  return L.join("\n");
}

// ---------------------------------------------------------------------------
//  Parseo defensivo de la respuesta del modelo
// ---------------------------------------------------------------------------
const texto = (v, max = 6000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function extraerJSON(bruto) {
  const limpio = String(bruto || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(limpio);
  } catch {
    // Por si el modelo ha añadido alguna frase alrededor del objeto.
    const ini = limpio.indexOf("{");
    const fin = limpio.lastIndexOf("}");
    if (ini === -1 || fin <= ini) return null;
    try {
      return JSON.parse(limpio.slice(ini, fin + 1));
    } catch {
      return null;
    }
  }
}

/**
 * Convierte lo que ha devuelto el modelo en una campaña con la misma forma que
 * la del modo estudio. Todo campo que falte o venga mal se toma de `respaldo`,
 * así que el frontend siempre recibe la estructura completa.
 */
export function normalizarCampanaIA(datos, respaldo, b) {
  if (!datos || typeof datos !== "object") return null;

  const escenas = Array.isArray(datos.escenas)
    ? datos.escenas
        .filter((e) => e && typeof e === "object")
        .slice(0, 20)
        .map((e, i) => ({
          n: Number.isFinite(Number(e.n)) ? Number(e.n) : i + 1,
          desde: Math.max(0, Number(e.desde) || 0),
          hasta: Math.max(0, Number(e.hasta) || 0),
          dura: Math.max(0, (Number(e.hasta) || 0) - (Number(e.desde) || 0)),
          etiqueta: texto(e.etiqueta, 80) || `Escena ${i + 1}`,
          plano: texto(e.plano, 120),
          camara: texto(e.camara, 120),
          luz: texto(e.luz, 400),
          accion: texto(e.accion, 800),
          texto: texto(e.texto, 200),
          ratio: b.plataforma.ratio,
        }))
    : [];

  const variantes = Array.isArray(datos.variantes)
    ? datos.variantes
        .filter((v) => v && typeof v === "object")
        .slice(0, 5)
        .map((v) => ({
          tipo: texto(v.tipo, 60) || "Variante",
          titulo: texto(v.titulo, 160),
          idea: texto(v.idea, 1200),
        }))
    : [];

  const hashtags = Array.isArray(datos.hashtags)
    ? datos.hashtags
        .map((h) => texto(h, 60))
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h.replace(/\s+/g, "")}`))
        .slice(0, 25)
    : [];

  const notas = Array.isArray(datos.notas)
    ? datos.notas.map((n) => texto(n, 600)).filter(Boolean).slice(0, 10)
    : [];

  return {
    motor: "ia",
    titulo: texto(datos.titulo, 160) || respaldo.titulo,
    concepto: texto(datos.concepto, 2500) || respaldo.concepto,
    eslogan: texto(datos.eslogan, 200) || respaldo.eslogan,
    perfilComprador: texto(datos.perfilComprador, 1500) || respaldo.perfilComprador,
    promptES: texto(datos.promptES) || respaldo.promptES,
    promptEN: texto(datos.promptEN) || respaldo.promptEN,
    escenas: escenas.length ? escenas : respaldo.escenas,
    vozEnOff: texto(datos.vozEnOff, 2500) || respaldo.vozEnOff,
    copyInstagram: texto(datos.copyInstagram, 2500) || respaldo.copyInstagram,
    copyTiktok: texto(datos.copyTiktok, 1200) || respaldo.copyTiktok,
    youtube: {
      titulo: texto(datos.youtube?.titulo, 200) || respaldo.youtube.titulo,
      descripcion: texto(datos.youtube?.descripcion, 3000) || respaldo.youtube.descripcion,
    },
    hashtags: hashtags.length ? hashtags : respaldo.hashtags,
    cta: texto(datos.cta, 400) || respaldo.cta,
    // El negative prompt de la casa siempre va: si el modelo aporta el suyo, se
    // suma, pero nunca sustituye a la lista completa.
    negativePrompt: texto(datos.negativePrompt, 3000)
      ? `${NEGATIVE_PROMPT}, ${texto(datos.negativePrompt, 3000)}`
      : NEGATIVE_PROMPT,
    negativePromptEN: NEGATIVE_PROMPT_EN,
    variantes: variantes.length ? variantes : respaldo.variantes,
    // Los avisos de honestidad los calculamos nosotros a partir del briefing:
    // no dependen de que el modelo se acuerde de escribirlos.
    notas: [...new Set([...notas, ...notasDeHonestidad(b)])],
  };
}

// ---------------------------------------------------------------------------
//  Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }

  const cuerpo = req.body ?? {};
  const { ok, errores, briefing } = normalizarBriefing(cuerpo);
  if (!ok) {
    return res.status(400).json({ error: errores.join(" "), errores });
  }

  // Campaña del estudio local: es a la vez el resultado del modo "estudio" y
  // la red de seguridad del modo IA.
  const respaldo = componerCampana(briefing);
  const responder = (campana, aviso) => {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      campana,
      texto: campanaATexto(campana, briefing),
      ficha: fichaDelInmueble(briefing),
      aviso: aviso || null,
    });
  };

  const quiereIA = String(cuerpo.motor || "ia").toLowerCase() !== "estudio";
  if (!quiereIA) return responder(respaldo, null);

  if (!process.env.ANTHROPIC_API_KEY) {
    return responder(
      respaldo,
      "Campaña generada en modo estudio (sin IA): falta la clave ANTHROPIC_API_KEY en Vercel → Settings → Environment Variables. Todo lo que ves es utilizable; con la clave puesta, la versión de IA es más específica."
    );
  }

  try {
    const client = new Anthropic();
    const respuesta = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: "text", text: promptMaestro(), cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: briefingParaModelo(briefing) }],
    });

    const bruto = respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const campana = normalizarCampanaIA(extraerJSON(bruto), respaldo, briefing);
    if (!campana) {
      console.error("La respuesta de Claude no era JSON válido en /api/luxury-motion.");
      return responder(
        respaldo,
        "La IA devolvió una respuesta que no se pudo leer, así que aquí tienes la campaña del estudio local. Pulsa «Regenerar versión» para volver a intentarlo con IA."
      );
    }
    return responder(campana, null);
  } catch (err) {
    let aviso =
      "La IA no ha podido responder ahora mismo, así que esta campaña la ha compuesto el estudio local. Vuelve a intentarlo en un momento.";
    if (err instanceof Anthropic.AuthenticationError) {
      aviso = "La clave ANTHROPIC_API_KEY no es válida: revísala en Vercel. Mientras tanto, esta campaña la ha compuesto el estudio local.";
    } else if (err instanceof Anthropic.RateLimitError) {
      aviso = "Demasiadas campañas seguidas: la API pide una pausa. Esta la ha compuesto el estudio local; espera unos segundos y regenera.";
    } else if (err instanceof Anthropic.APIError) {
      console.error("Error de la API de Claude en /api/luxury-motion:", err.status, err.message);
      aviso = `La API de Claude devolvió un error (${err.status}). Esta campaña la ha compuesto el estudio local.`;
    } else {
      console.error("Error interno en /api/luxury-motion:", err);
    }
    return responder(respaldo, aviso);
  }
}
