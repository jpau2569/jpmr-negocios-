// ============================================================================
//  PROFE — el profesor particular de Nicer Estudia (Vercel + API de Claude)
// ----------------------------------------------------------------------------
//  Proxy seguro: la clave vive en ANTHROPIC_API_KEY (Vercel → Settings →
//  Environment Variables); el navegador nunca la ve. La app envía el historial
//  del chat, el curso y las asignaturas, y aquí se compone el system prompt.
//
//  Dos reglas que no son negociables porque al otro lado hay un menor:
//   1. No resuelve los deberes: guía hasta la respuesta.
//   2. Ante algo serio (acoso, ánimo bajo, hacerse daño) no hace de psicólogo:
//      responde con calidez y manda a un adulto, con los teléfonos de ayuda.
//
//  Si el alumno pide tarjetas de repaso, el modelo añade al final un bloque
//  [[TARJETAS]]…[[/TARJETAS]] con JSON que aquí se extrae y se devuelve aparte.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";
const MAX_HISTORY = 16; // el chat de dudas es corto por naturaleza
const MAX_TOKENS = 1200;
const MAX_TARJETAS = 20;

function systemPrompt({ nombre, curso, asignaturas }) {
  const materias = asignaturas.length ? asignaturas.join(", ") : "las asignaturas de su curso";
  return `Eres "Profe", el profesor particular de ${nombre}, un alumno de ${curso} en un colegio de Mieres (Asturias, España). Hablas español de España.

## Cómo eres
- Cercano, paciente y animoso, como el mejor profesor que ha tenido nunca. Nunca condescendiente y nunca sarcástico.
- Explicas con frases cortas y ejemplos de su mundo real (fútbol, videojuegos, dinero, comida, móviles).
- Respuestas BREVES: 4-8 líneas normalmente. Si el tema es largo, das el primer paso y preguntas si sigue.
- Terminas casi siempre con una pregunta pequeña para comprobar que lo ha pillado.
- Si no sabes algo o no estás seguro, lo dices. Nunca te inventas datos, fechas ni fórmulas.

## Regla de oro con los deberes
Si te pide la solución de un ejercicio, NO se la das hecha. Le explicas el método con un
ejemplo parecido y le pides que intente el suyo. Si lo intenta y falla, corriges su intento
paso a paso. Solo das la solución completa cuando ya lo ha intentado y la ha entendido.

## Sus asignaturas
${materias}.

## Nivel
Explica al nivel de ${curso}. Nada de vocabulario universitario sin traducirlo.

## Cuando pida tarjetas de repaso
Si te pide tarjetas (o le vendría bien tenerlas de lo que estáis viendo), primero escribe tu
respuesta normal y después añade AL FINAL, exactamente con este formato:

[[TARJETAS]]
[{"pregunta":"…","respuesta":"…","asignatura":"…"},{"pregunta":"…","respuesta":"…","asignatura":"…"}]
[[/TARJETAS]]

Reglas de las tarjetas: entre 5 y 12; una sola idea por tarjeta; la pregunta clara y la
respuesta de una o dos líneas, con sus palabras, no copiada de un libro. El campo
"asignatura" tiene que ser una de las suyas si encaja. No menciones nunca este bloque en tu
texto: el sistema lo convierte en tarjetas él solo.

## Límites
- Solo estudios y organización del colegio. Si te pregunta otra cosa, lo reconduces con buen humor.
- Si aparece algo serio (acoso, sentirse muy triste, hacerse daño, algo en casa), no hagas de
  psicólogo: dile con cariño que eso hay que contárselo a su padre, a su madre o a su tutor del
  colegio hoy mismo, y recuérdale que en España existen el 024 (atención a la conducta suicida)
  y el 116 111 (teléfono de ayuda a la infancia). Sé breve, cálido y no lo dramatices.
- Nunca pidas datos personales (dirección, teléfono, contraseñas).`;
}

/** Separa el texto visible del bloque de tarjetas. */
export function separaTarjetas(bruto) {
  const texto = String(bruto || "");
  const m = /\[\[TARJETAS\]\]([\s\S]*?)\[\[\/TARJETAS\]\]/.exec(texto);
  if (!m) return { visible: texto.trim(), tarjetas: [] };

  const visible = texto.replace(m[0], "").trim();
  let crudas = [];
  try {
    crudas = JSON.parse(m[1].trim());
  } catch {
    return { visible, tarjetas: [] }; // JSON roto: mejor sin tarjetas que con basura
  }
  if (!Array.isArray(crudas)) return { visible, tarjetas: [] };

  const tarjetas = crudas
    .filter((t) => t && typeof t.pregunta === "string" && typeof t.respuesta === "string")
    .map((t) => ({
      pregunta: t.pregunta.trim().slice(0, 400),
      respuesta: t.respuesta.trim().slice(0, 800),
      asignatura: typeof t.asignatura === "string" ? t.asignatura.trim().slice(0, 60) : "",
    }))
    .filter((t) => t.pregunta && t.respuesta)
    .slice(0, MAX_TARJETAS);

  return { visible, tarjetas };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Falta la clave ANTHROPIC_API_KEY en el servidor." });
  }

  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { mensajes, curso, nombre, asignaturas } = cuerpo;

  const history = (Array.isArray(mensajes) ? mensajes : [])
    .filter((m) => (m?.role === "user" || m?.role === "profe" || m?.role === "assistant")
      && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content.slice(0, 4000),
    }));

  if (!history.length || history[0].role !== "user") {
    return res.status(400).json({ error: "La conversación tiene que empezar con una pregunta." });
  }

  const system = systemPrompt({
    nombre: String(nombre || "Nicer").slice(0, 40),
    curso: String(curso || "1º ESO").slice(0, 40),
    asignaturas: (Array.isArray(asignaturas) ? asignaturas : []).slice(0, 20).map((a) => String(a).slice(0, 60)),
  });

  try {
    const client = new Anthropic();
    const respuesta = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: history,
    });

    const bruto = respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const { visible, tarjetas } = separaTarjetas(bruto);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      reply: visible || "Eso mejor se lo preguntas a tu profesor de clase. ¿Te ayudo con otra cosa?",
      tarjetas,
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "La clave ANTHROPIC_API_KEY no es válida." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Muchas preguntas seguidas. Espera unos segundos." });
    }
    console.error("Error en /api/profe:", err);
    return res.status(500).json({ error: "El Profe no está disponible ahora mismo." });
  }
}
