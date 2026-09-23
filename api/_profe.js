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
//  Si el alumno pide material, el modelo añade al final un bloque con JSON
//  que aquí se extrae y se devuelve aparte, sin que el alumno lo vea:
//    [[TARJETAS]] → tarjetas de repaso
//    [[TEST]]     → preguntas de opción múltiple para autoevaluarse
//    [[ESQUEMA]]  → el tema en ramas, que la app dibuja como mapa
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

## Material que puedes prepararle
Cuando te lo pida (o cuando le venga claramente bien), escribe primero tu respuesta normal y
después añade AL FINAL **un solo bloque** de los siguientes, con este formato exacto. Nunca
menciones estos bloques en tu texto: el sistema los convierte en material él solo, y el alumno
solo ve el resultado.

**Tarjetas de repaso** — cuando pida tarjetas o esté estudiando un tema:
[[TARJETAS]]
[{"pregunta":"…","respuesta":"…","asignatura":"…"}]
[[/TARJETAS]]
Entre 5 y 12; una sola idea por tarjeta; respuesta de una o dos líneas y con sus palabras.

**Test** — cuando pida un test, un examen de prueba o ponerse a prueba:
[[TEST]]
{"titulo":"…","asignatura":"…","preguntas":[{"pregunta":"…","opciones":["…","…","…","…"],"correcta":0}]}
[[/TEST]]
Entre 5 y 10 preguntas, 4 opciones cada una, "correcta" es el índice (empezando en 0) de la
buena. Las opciones falsas tienen que ser creíbles, no absurdas: si no, no se aprende nada.

**Esquema** — cuando pida un esquema, un resumen visual o un mapa del tema:
[[ESQUEMA]]
{"titulo":"…","asignatura":"…","ramas":[{"titulo":"…","puntos":["…","…"]}]}
[[/ESQUEMA]]
Entre 3 y 6 ramas, cada una con 2 o 4 puntos cortos (una línea). El esquema es para verlo de
un vistazo antes de memorizar, así que nada de párrafos.

El campo "asignatura" tiene que ser una de las suyas si encaja.

## Límites
- Solo estudios y organización del colegio. Si te pregunta otra cosa, lo reconduces con buen humor.
- Si aparece algo serio (acoso, sentirse muy triste, hacerse daño, algo en casa), no hagas de
  psicólogo: dile con cariño que eso hay que contárselo a su padre, a su madre o a su tutor del
  colegio hoy mismo, y recuérdale que en España existen el 024 (atención a la conducta suicida)
  y el 116 111 (teléfono de ayuda a la infancia). Sé breve, cálido y no lo dramatices.
- Nunca pidas datos personales (dirección, teléfono, contraseñas).`;
}

/** Saca un bloque [[NOMBRE]]…[[/NOMBRE]] y lo quita del texto visible. */
function extraeBloque(texto, nombre) {
  const patron = new RegExp(`\\[\\[${nombre}\\]\\]([\\s\\S]*?)\\[\\[/${nombre}\\]\\]`);
  const m = patron.exec(texto);
  if (!m) return { texto, datos: null };
  const limpio = texto.replace(m[0], "").trim();
  try {
    return { texto: limpio, datos: JSON.parse(m[1].trim()) };
  } catch {
    return { texto: limpio, datos: null }; // JSON roto: mejor nada que basura
  }
}

const cadena = (v, largo) => (typeof v === "string" ? v.trim().slice(0, largo) : "");

/**
 * Separa el texto que ve el alumno del material que genera el modelo.
 * Devuelve `{ visible, tarjetas, test, esquema }`; lo que no cuadre, se cae.
 */
export function separaBloques(bruto) {
  let texto = String(bruto || "");

  const conTarjetas = extraeBloque(texto, "TARJETAS");
  texto = conTarjetas.texto;
  const tarjetas = (Array.isArray(conTarjetas.datos) ? conTarjetas.datos : [])
    .map((t) => ({
      pregunta: cadena(t?.pregunta, 400),
      respuesta: cadena(t?.respuesta, 800),
      asignatura: cadena(t?.asignatura, 60),
    }))
    .filter((t) => t.pregunta && t.respuesta)
    .slice(0, MAX_TARJETAS);

  const conTest = extraeBloque(texto, "TEST");
  texto = conTest.texto;
  const brutoTest = conTest.datos;
  const preguntas = (Array.isArray(brutoTest?.preguntas) ? brutoTest.preguntas : [])
    .map((p) => {
      const opciones = (Array.isArray(p?.opciones) ? p.opciones : [])
        .map((o) => cadena(o, 200))
        .filter(Boolean)
        .slice(0, 4);
      const correcta = Number(p?.correcta);
      if (!cadena(p?.pregunta, 300) || opciones.length < 2) return null;
      if (!Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) return null;
      return { pregunta: cadena(p.pregunta, 300), opciones, correcta };
    })
    .filter(Boolean)
    .slice(0, 20);

  const conEsquema = extraeBloque(texto, "ESQUEMA");
  texto = conEsquema.texto;
  const brutoEsquema = conEsquema.datos;
  const ramas = (Array.isArray(brutoEsquema?.ramas) ? brutoEsquema.ramas : [])
    .map((r) => ({
      titulo: cadena(r?.titulo, 80),
      puntos: (Array.isArray(r?.puntos) ? r.puntos : []).map((x) => cadena(x, 120)).filter(Boolean).slice(0, 6),
    }))
    .filter((r) => r.titulo)
    .slice(0, 8);

  return {
    visible: texto.trim(),
    tarjetas,
    test: preguntas.length ? preguntas : [],
    esquema: ramas.length
      ? {
          titulo: cadena(brutoEsquema?.titulo, 120) || "Esquema",
          asignatura: cadena(brutoEsquema?.asignatura, 60),
          ramas,
        }
      : null,
  };
}

/** Compatibilidad: solo las tarjetas. */
export const separaTarjetas = (bruto) => {
  const { visible, tarjetas } = separaBloques(bruto);
  return { visible, tarjetas };
};

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
    const { visible, tarjetas, test, esquema } = separaBloques(bruto);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      reply: visible || "Eso mejor se lo preguntas a tu profesor de clase. ¿Te ayudo con otra cosa?",
      tarjetas,
      test,
      esquema,
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
