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
//
//  Además del chat, tres modos de trabajo (campo `modo` de la petición):
//    leccion  → resume una lección (texto o hasta 6 fotos de páginas) en
//               resumen, apuntes y conceptos clave        → [[LECCION]]
//    examen   → examen de prueba de las lecciones que entran → [[EXAMEN]]
//    corregir → corrige las preguntas de desarrollo          → [[CORRECCION]]
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
const MAX_FOTOS_LECCION = 6;
const MAX_TOTAL_B64 = 3_800_000; // todas las páginas juntas, por debajo de los 4,5 MB
const MODOS = ["chat", "leccion", "examen", "corregir"];

/* Instrucciones de cada modo de trabajo. Van en un bloque de sistema aparte
   del principal para que el prompt de Clara (el largo) siga en caché. */
const INSTRUCCIONES_MODO = {
  leccion: `## Modo lección: resumen y apuntes
Te paso una lección que está estudiando (escrita o en fotos de las páginas del libro). Tu
trabajo es dejarle el mejor material de estudio posible, fiel a SU lección: no añadas temas
que no salen en ella ni te inventes datos. Si una foto no se lee, dilo en tu respuesta.
Escribe una o dos líneas para él ("Te he hecho los apuntes del tema 3…") y después el bloque:
[[LECCION]]
{"resumen":"…","apuntes":[{"titulo":"…","puntos":["…","…"]}],"conceptos":[{"termino":"…","definicion":"…"}]}
[[/LECCION]]
- resumen: 5-8 frases claras, lo esencial de la lección, a su nivel.
- apuntes: 3-8 apartados siguiendo el orden de la lección; cada uno con 2-6 puntos cortos
  (una línea), con los datos, fechas, fórmulas y ejemplos que de verdad entran.
- conceptos: 5-12 términos clave con una definición de una línea, con sus palabras.
Si la lección está en inglés (asignaturas bilingües), los apuntes van en inglés.`,

  examen: `## Modo examen de prueba
Hazle un examen de prueba como los de verdad de 2º de ESO, SOLO con lo que sale en el
contenido de sus lecciones que te paso. Escribe una línea de ánimo y después el bloque:
[[EXAMEN]]
{"titulo":"…","test":[{"pregunta":"…","opciones":["…","…","…","…"],"correcta":0}],"desarrollo":[{"pregunta":"…","puntos":2,"criterios":"…"}]}
[[/EXAMEN]]
- test: 6-8 preguntas de opción múltiple, 4 opciones creíbles, "correcta" es el índice (desde 0).
- desarrollo: 2-3 preguntas para contestar con sus palabras (definir, explicar, comparar,
  resolver un problema). "puntos" entre 1 y 4. "criterios": lo que tiene que aparecer en una
  respuesta de 10, para corregirla después (él no lo ve hasta el final).
- Mezcla lo fácil con lo que más cuesta, y reparte las preguntas entre todas las lecciones.`,

  corregir: `## Modo corregir
Corrige sus respuestas de desarrollo como una profesora justa y cariñosa: valora lo que
está bien aunque esté mal escrito, y di en concreto qué falta. Usa los criterios de cada
pregunta. Escribe una línea de valoración general y después el bloque, con una corrección por
pregunta y en el mismo orden:
[[CORRECCION]]
{"correcciones":[{"nota":7,"bien":"…","mejorar":"…","modelo":"…"}]}
[[/CORRECCION]]
- nota: de 0 a 10 (se admiten decimales). Una respuesta en blanco es 0.
- bien: lo que ha hecho bien (una frase). mejorar: lo que le falta o sobra (una frase).
- modelo: la respuesta de 10, corta, para que la aprenda.`
};

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

  // Material de los modos de trabajo: aquí solo se comprueba que sea un
  // objeto; la app lo valida campo a campo con lecciones.js antes de usarlo.
  const objeto = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
  const conLeccion = extraeBloque(texto, "LECCION");
  texto = conLeccion.texto;
  const conExamen = extraeBloque(texto, "EXAMEN");
  texto = conExamen.texto;
  const conCorreccion = extraeBloque(texto, "CORRECCION");
  texto = conCorreccion.texto;

  return {
    visible: texto.trim(),
    tarjetas,
    horario,
    leccion: objeto(conLeccion.datos),
    examen: objeto(conExamen.datos),
    correccion: objeto(conCorreccion.datos),
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

/** Varias fotos (páginas de una lección): válidas, como mucho 6 y sin pasar
    del total que cabe en una petición de Vercel. */
export function imagenesValidas(imagenes) {
  const salida = [];
  let total = 0;
  for (const bruta of Array.isArray(imagenes) ? imagenes : []) {
    const foto = imagenValida(bruta);
    if (!foto) continue;
    if (total + foto.data.length > MAX_TOTAL_B64 || salida.length >= MAX_FOTOS_LECCION) break;
    total += foto.data.length;
    salida.push(foto);
  }
  return salida;
}

const bloqueImagen = (f) => ({ type: "image", source: { type: "base64", media_type: f.media_type, data: f.data } });
const corta = (v, n) => String(v ?? "").slice(0, n);

/** El único mensaje de un modo de trabajo. Devuelve null si falta lo básico. */
export function mensajeDeModo(modo, cuerpo) {
  if (modo === "leccion") {
    const l = cuerpo.leccion || {};
    const fotos = imagenesValidas(cuerpo.imagenes);
    const textoLeccion = corta(l.texto, 30000).trim();
    if (!fotos.length && !textoLeccion) return null;
    const cabecera = `Esta es mi lección de ${corta(l.asignatura, 60) || "clase"}`
      + (l.libro ? ` (libro: ${corta(l.libro, 120)})` : "")
      + ` titulada «${corta(l.titulo, 120) || "sin título"}».`
      + (fotos.length ? ` Te mando ${fotos.length} foto(s) de las páginas.` : "")
      + (textoLeccion ? `\n\nTexto de la lección:\n${textoLeccion}` : "")
      + "\n\nHazme el resumen, los apuntes y los conceptos clave.";
    return { role: "user", content: [...fotos.map(bloqueImagen), { type: "text", text: cabecera }] };
  }
  if (modo === "examen") {
    const e = cuerpo.examen || {};
    const contenido = corta(cuerpo.contenido, 16000).trim();
    const texto = `Hazme un examen de prueba de ${corta(e.asignatura, 60) || "mi asignatura"}: «${corta(e.titulo, 120) || "examen"}».`
      + (e.temas ? ` Entra: ${corta(e.temas, 500)}.` : "")
      + (contenido
        ? `\n\nEste es el contenido de mis lecciones (usa solo esto):\n${contenido}`
        : "\n\nNo tengo las lecciones metidas en la app: hazlo con lo que se da en 2º de ESO de ese tema, y avísame de que no es con mis apuntes.");
    return { role: "user", content: texto };
  }
  if (modo === "corregir") {
    const preguntas = (Array.isArray(cuerpo.preguntas) ? cuerpo.preguntas : []).slice(0, 4);
    if (!preguntas.length) return null;
    const texto = "Corrígeme estas respuestas de desarrollo:\n\n" + preguntas.map((p, i) =>
      `${i + 1}. Pregunta: ${corta(p.pregunta, 400)}\n   Criterios: ${corta(p.criterios, 800)}\n   Mi respuesta: ${corta(p.respuesta, 3000).trim() || "(en blanco)"}`
    ).join("\n\n");
    return { role: "user", content: texto };
  }
  return null;
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
  const modo = MODOS.includes(cuerpo.modo) ? cuerpo.modo : "chat";

  const history = modo !== "chat" ? [] : (Array.isArray(mensajes) ? mensajes : [])
    .filter((m) => (m?.role === "user" || m?.role === "profe" || m?.role === "assistant")
      && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content.slice(0, 4000),
    }));

  if (modo !== "chat") {
    const mensaje = mensajeDeModo(modo, cuerpo);
    if (!mensaje) {
      return res.status(400).json({ error: modo === "leccion"
        ? "Mete el texto de la lección o alguna foto de las páginas."
        : "Faltan datos para hacerlo." });
    }
    history.push(mensaje);
  }

  if (!history.length || history[0].role !== "user") {
    return res.status(400).json({ error: "La conversación tiene que empezar con una pregunta." });
  }

  // La foto va delante del texto en el último mensaje del alumno.
  const foto = modo === "chat" ? imagenValida(imagen) : null;
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
    curso: String(curso || "2º ESO").slice(0, 40),
    asignaturas: (Array.isArray(asignaturas) ? asignaturas : []).slice(0, 20).map((a) => String(a).slice(0, 60)),
    buscador,
  });

  const peticion = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    // Es un chat con un chaval: rapidez antes que exhaustividad. Corregir es
    // lo más sencillo y lo que más impaciencia da, así que va en "low".
    output_config: { effort: modo === "corregir" ? "low" : "medium" },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: history,
  };
  if (INSTRUCCIONES_MODO[modo]) peticion.system.push({ type: "text", text: INSTRUCCIONES_MODO[modo] });
  // Sin clave de Gemini no se ofrece la herramienta: así Clara no promete
  // buscar algo que luego no puede. En los modos de trabajo no hace falta.
  if (buscador && modo === "chat") peticion.tools = [HERRAMIENTA_BUSCAR];

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
        tarjetas: [], test: [], esquema: null, horario: null, leccion: null, examen: null, correccion: null, busquedas, modo,
      });
    }

    const { visible, tarjetas, test, esquema, horario, leccion, examen, correccion } = separaBloques(textoDe(respuesta.content));
    const reply = visible
      || (respuesta.stop_reason === "tool_use"
        ? "He buscado bastante y no he llegado a una respuesta clara. ¿Me lo preguntas de otra forma?"
        : "No he sabido responder a eso. ¿Me lo cuentas de otra manera?");

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ reply, tarjetas, test, esquema, horario, leccion, examen, correccion, busquedas, modo });
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
