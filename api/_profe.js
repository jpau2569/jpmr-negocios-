// ============================================================================
//  CLARA, la profe de Nicer Estudia (Vercel + API de Claude)
// ----------------------------------------------------------------------------
//  Es CLARA —la misma asistente de Pau— con un sombrero distinto: el de
//  profesora particular de un alumno de ESO. De la Clara de Pau se queda con
//  la voz, la calidez y el buscador de Internet con fuentes; NO se lleva su
//  memoria, su cartera de pisos ni el modo psicóloga, porque al otro lado hay
//  un menor. Se sirve en /api/profe a través del enrutador api/[ruta].js.
//
//  Proxy seguro: la clave vive en ANTHROPIC_API_KEY (y la del buscador en
//  GEMINI_API_KEY); el navegador nunca las ve.
//
//  Reglas que no son negociables:
//   1. No resuelve los deberes: guía hasta la respuesta.
//   2. Ante algo serio (acoso, ánimo bajo, hacerse daño) no hace de psicóloga:
//      responde con calidez y manda a un adulto, con los teléfonos de ayuda.
//   3. Lo que busca en Internet lo cita con su fuente.
//
//  Acepta una foto (ejercicio, página del libro, apuntes u horario) en el
//  último mensaje. Si el alumno pide material, el modelo añade al final un
//  bloque con JSON que aquí se extrae y se devuelve aparte:
//    [[TARJETAS]] → tarjetas de repaso (con idioma, para oírlas en inglés)
//    [[TEST]]     → preguntas de opción múltiple para autoevaluarse
//    [[ESQUEMA]]  → el tema en ramas, que la app dibuja como mapa
//    [[HORARIO]]  → el horario semanal leído de una foto
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { buscarConGemini } from "./_clara.js";

const MODEL = "claude-sonnet-5";
const MAX_HISTORY = 16; // el chat de dudas es corto por naturaleza
// Holgado a propósito: con 1200 un test de diez preguntas en JSON podía
// cortarse a medias, y un bloque cortado se pierde entero sin avisar.
const MAX_TOKENS = 8000;
const MAX_TARJETAS = 20;
const MAX_RONDAS = 3; // búsquedas por respuesta: de sobra para un trabajo de clase
const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
// Vercel corta las peticiones de más de 4,5 MB. La app ya reduce la foto a
// 1600 px (unos 300-600 KB), así que esto solo frena lo que no viene de ella.
const MAX_IMAGEN_B64 = 3_500_000;

function systemPrompt({ nombre, curso, asignaturas, buscador }) {
  const materias = asignaturas.length ? asignaturas.join(", ") : "las asignaturas de su curso";
  return `Eres CLARA, la profesora particular de ${nombre}, un alumno de ${curso} en el Colegio Lastra de Mieres (Asturias, España). Es un colegio bilingüe: parte de las asignaturas van en inglés. Hablas español de España y le tratas de tú.

Eres la misma Clara que ayuda a su padre, Pau, pero aquí solo llevas puesto un sombrero: el de profesora. No hablas del trabajo de Pau ni de nada suyo.

## Cómo eres
- Cálida, paciente y con buen humor, como la mejor profesora que ha tenido nunca. Nunca condescendiente y nunca sarcástica.
- Explicas con frases cortas y ejemplos de su mundo (fútbol, videojuegos, dinero, comida, móviles).
- Respuestas BREVES: 4-8 líneas normalmente. Si el tema es largo, das el primer paso y preguntas si sigues.
- Terminas casi siempre con una pregunta pequeña para comprobar que lo ha pillado.
- Si no sabes algo o no estás segura, lo dices. Nunca te inventas datos, fechas ni fórmulas.
- Celebras de verdad cuando lo consigue, sin exagerar.

## Regla de oro con los deberes
Si te pide la solución de un ejercicio, NO se la das hecha. Le explicas el método con un
ejemplo parecido y le pides que intente el suyo. Si lo intenta y falla, corriges su intento
paso a paso. Solo das la solución completa cuando ya lo ha intentado y la ha entendido.
Con los trabajos y redacciones igual: le ayudas a buscar información, a hacer el guion y a
revisar lo que él escribe, pero no se lo escribes tú.

## Si te manda una foto
Puede ser un ejercicio, una página del libro, sus apuntes o su horario. Primero di en una
línea qué ves ("Veo el ejercicio 4 de fracciones…"). Si no se lee bien, pídele otra foto con
más luz y más cerca en vez de adivinar. Con un ejercicio, aplica la regla de oro.

## Sus asignaturas
${materias}.

## Nivel
Explica al nivel de ${curso}. Nada de vocabulario universitario sin traducirlo. En inglés,
si te habla en inglés le contestas en inglés sencillo y le corriges con cariño los errores.
${buscador ? `
## Buscar en Internet
Tienes la herramienta "buscar_web" (Google, a través de Gemini). Úsala cuando necesite datos
que no sepas con seguridad o que dependan de la actualidad, y sobre todo para sus trabajos de
clase. Cita SIEMPRE de dónde sale cada dato (nombre de la web) y enséñale a no copiar: a leer,
resumir con sus palabras y poner la fuente. Si la búsqueda falla, dilo claro.
` : ""}
## Material que puedes prepararle
Cuando te lo pida (o cuando le venga claramente bien), escribe primero tu respuesta normal y
después añade AL FINAL **un solo bloque** de los siguientes, con este formato exacto. Nunca
menciones estos bloques en tu texto: el sistema los convierte en material él solo, y el alumno
solo ve el resultado.

**Tarjetas de repaso** — cuando pida tarjetas o esté estudiando un tema:
[[TARJETAS]]
[{"pregunta":"…","respuesta":"…","asignatura":"…","idioma":"es"}]
[[/TARJETAS]]
Entre 5 y 12; una sola idea por tarjeta; respuesta de una o dos líneas y con sus palabras.
"idioma" es "en" si la tarjeta está en inglés (vocabulario, asignaturas bilingües) y "es" si no:
la app las lee en voz alta con el acento correcto.

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
Entre 3 y 6 ramas, cada una con 2 o 4 puntos cortos (una línea). Nada de párrafos.

**Horario** — SOLO cuando te mande una foto de su horario de clases:
[[HORARIO]]
{"dias":{"1":[{"hora":"08:15","asignatura":"Matemáticas"}],"2":[],"3":[],"4":[],"5":[]}}
[[/HORARIO]]
"1" es lunes y "5" viernes. "hora" en formato HH:MM (vacía si no se lee). Pon el nombre de la
asignatura como lo tiene en su lista si encaja; si no, tal como aparece en la foto. Copia solo
lo que se lee en la foto: no te inventes clases. Recreos y comedor no van.

El campo "asignatura" tiene que ser una de las suyas si encaja.

## Límites
- Solo estudios y organización del colegio. Si te pregunta otra cosa, lo reconduces con buen humor.
- Si aparece algo serio (acoso, sentirse muy triste, hacerse daño, algo en casa), no hagas de
  psicóloga: dile con cariño que eso hay que contárselo a su padre, a su madre o a su tutor del
  colegio hoy mismo, y recuérdale que en España existen el 024 (atención a la conducta suicida)
  y el 116 111 (teléfono de ayuda a la infancia). Sé breve, cálida y no lo dramatices.
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
      idioma: t?.idioma === "en" ? "en" : "es",
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

  const conHorario = extraeBloque(texto, "HORARIO");
  texto = conHorario.texto;
  const horario = horarioValido(conHorario.datos);

  return {
    visible: texto.trim(),
    tarjetas,
    horario,
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

/* Un horario leído de una foto: días 1-7, como mucho 12 clases al día, hora
   HH:MM o vacía. Lo que no cuadre se cae; si no queda ninguna clase, null. */
function horarioValido(bruto) {
  const dias = bruto?.dias && typeof bruto.dias === "object" ? bruto.dias : null;
  if (!dias) return null;
  const salida = {};
  let total = 0;
  for (let d = 1; d <= 7; d++) {
    const clases = (Array.isArray(dias[d]) ? dias[d] : Array.isArray(dias[String(d)]) ? dias[String(d)] : [])
      .map((c) => {
        const hora = cadena(c?.hora, 5);
        return {
          hora: /^([01]?\d|2[0-3]):[0-5]\d$/.test(hora) ? hora.padStart(5, "0") : "",
          asignatura: cadena(c?.asignatura, 60),
        };
      })
      .filter((c) => c.asignatura)
      .slice(0, 12);
    if (clases.length) salida[d] = clases;
    total += clases.length;
  }
  return total ? { dias: salida } : null;
}

/** Compatibilidad: solo las tarjetas. */
export const separaTarjetas = (bruto) => {
  const { visible, tarjetas } = separaBloques(bruto);
  return { visible, tarjetas };
};

/** La foto solo viaja con el último mensaje; lo que no sea una imagen
    razonable se ignora en vez de romper la conversación. */
export function imagenValida(imagen) {
  if (!imagen || typeof imagen !== "object") return null;
  const tipo = String(imagen.media_type || "");
  const datos = String(imagen.data || "");
  if (!TIPOS_IMAGEN.includes(tipo)) return null;
  if (!datos || datos.length > MAX_IMAGEN_B64 || !/^[A-Za-z0-9+/=]+$/.test(datos)) return null;
  return { media_type: tipo, data: datos };
}

const HERRAMIENTA_BUSCAR = {
  name: "buscar_web",
  description:
    "Busca información en Internet con Google (vía Gemini) y devuelve un resumen con las fuentes. Úsala para datos que no sepas con seguridad, temas de actualidad y trabajos de clase.",
  input_schema: {
    type: "object",
    properties: {
      consulta: { type: "string", description: "Lo que hay que buscar, en lenguaje natural." },
    },
    required: ["consulta"],
  },
};

const textoDe = (content) =>
  (content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Falta la clave ANTHROPIC_API_KEY en el servidor." });
  }

  let cuerpo;
  try {
    cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ error: "La petición no es JSON válido." });
  }
  const { mensajes, curso, nombre, asignaturas, imagen } = cuerpo;

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

  // La foto va delante del texto en el último mensaje del alumno.
  const foto = imagenValida(imagen);
  const ultimo = history[history.length - 1];
  if (foto && ultimo.role === "user") {
    ultimo.content = [
      { type: "image", source: { type: "base64", media_type: foto.media_type, data: foto.data } },
      { type: "text", text: ultimo.content },
    ];
  }

  const buscador = Boolean(process.env.GEMINI_API_KEY);
  const system = systemPrompt({
    nombre: String(nombre || "Nicer").slice(0, 40),
    curso: String(curso || "1º ESO").slice(0, 40),
    asignaturas: (Array.isArray(asignaturas) ? asignaturas : []).slice(0, 20).map((a) => String(a).slice(0, 60)),
    buscador,
  });

  const peticion = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    // Es un chat con un chaval: rapidez antes que exhaustividad.
    output_config: { effort: "medium" },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: history,
  };
  // Sin clave de Gemini no se ofrece la herramienta: así Clara no promete
  // buscar algo que luego no puede.
  if (buscador) peticion.tools = [HERRAMIENTA_BUSCAR];

  try {
    const client = new Anthropic();
    let respuesta = await client.messages.create(peticion);
    let busquedas = 0;

    for (let ronda = 0; ronda < MAX_RONDAS && respuesta.stop_reason === "tool_use"; ronda++) {
      const llamadas = respuesta.content.filter((b) => b.type === "tool_use");
      const resultados = await Promise.all(llamadas.map(async (llamada) => {
        let texto;
        if (llamada.name === "buscar_web") {
          busquedas += 1;
          texto = await buscarConGemini(String(llamada.input?.consulta || "")).catch(
            (e) => "No se pudo buscar: " + String(e?.message || e));
        } else {
          texto = `Herramienta desconocida: ${llamada.name}`;
        }
        // La API rechaza un tool_result vacío.
        return { type: "tool_result", tool_use_id: llamada.id, content: String(texto || "(sin resultado)") };
      }));
      // Se devuelve el contenido entero (también los bloques de razonamiento)
      // y todos los resultados juntos en un solo mensaje, como pide la API.
      peticion.messages = [
        ...peticion.messages,
        { role: "assistant", content: respuesta.content },
        { role: "user", content: resultados },
      ];
      respuesta = await client.messages.create(peticion);
    }

    if (respuesta.stop_reason === "refusal") {
      return res.status(200).json({
        reply: "Eso no te lo puedo contestar yo. Si es algo del cole, pregúntamelo de otra manera; si es otra cosa, mejor háblalo con tu padre.",
        tarjetas: [], test: [], esquema: null, horario: null, busquedas,
      });
    }

    const { visible, tarjetas, test, esquema, horario } = separaBloques(textoDe(respuesta.content));
    const reply = visible
      || (respuesta.stop_reason === "tool_use"
        ? "He buscado bastante y no he llegado a una respuesta clara. ¿Me lo preguntas de otra forma?"
        : "No he sabido responder a eso. ¿Me lo cuentas de otra manera?");

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ reply, tarjetas, test, esquema, horario, busquedas });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "La clave ANTHROPIC_API_KEY no es válida." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Muchas preguntas seguidas. Espera unos segundos." });
    }
    if (err instanceof Anthropic.BadRequestError) {
      console.error("Petición rechazada en /api/profe:", err.message);
      return res.status(400).json({ error: foto ? "No he podido leer la foto. Prueba con otra más nítida." : "No he podido procesar la pregunta." });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Error de la API de Claude en /api/profe:", err.status, err.message);
      return res.status(502).json({ error: "Clara no está disponible ahora mismo. Inténtalo en un momento." });
    }
    console.error("Error en /api/profe:", err);
    return res.status(500).json({ error: "Clara no está disponible ahora mismo." });
  }
}
