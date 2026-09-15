/**
 * Motor de respuestas del asistente.
 *
 * Está en un módulo aparte, sin dependencias de Supabase ni de Next, por dos
 * motivos: se puede probar con un test unitario, y el día que se conecte un LLM
 * con RAG solo hay que sustituir `buscarRespuesta` dejando intactas las reglas
 * de derivación, que son las que protegen al negocio y al cliente.
 */

/** Temas que NUNCA responde un asistente: los responde una persona colegiada. */
const TEMAS_PROFESIONALES = [
  "impuesto", "impuestos", "irpf", "iva", "itp", "plusvalia", "plusvalía", "hacienda",
  "herencia", "heredar", "testamento", "legitima", "legítima",
  "despido", "finiquito", "nomina", "nómina", "baja laboral", "indemnizacion", "indemnización",
  "hipoteca", "prestamo", "préstamo", "interes", "interés", "tae", "financiacion", "financiación",
  "demanda", "juicio", "denuncia", "desahucio", "embargo", "clausula", "cláusula",
  "sancion", "sanción", "multa", "recurso", "contrato de arrendamiento",
  "cuanto pagare", "cuánto pagaré", "cuanto tengo que pagar", "cuánto tengo que pagar",
  "me conviene", "que me sale mejor", "qué me sale mejor",
];

/** Cosas que el asistente no puede garantizar por mucho que se le insista. */
const PROMESAS_PROHIBIDAS = [
  "garantiza", "garantía de precio", "seguro que", "me lo reservas", "reservamelo", "resérvamelo",
  "cuanto vale mi casa", "cuánto vale mi casa", "cuanto vale mi piso", "cuánto vale mi piso",
  "tasa mi", "valorame", "valórame",
];

export const MENSAJE_DERIVACION = (negocio: string) =>
  `Para darte una respuesta precisa y adaptada a tu caso, el equipo de ${negocio} debe revisarlo contigo. ` +
  "Puedes solicitar una cita o contactar por WhatsApp.";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿Esta pregunta hay que derivar a una persona? */
export function requiereProfesional(pregunta: string): boolean {
  const p = normalizar(pregunta);
  const disparadores = [...TEMAS_PROFESIONALES, ...PROMESAS_PROHIBIDAS].map(normalizar);
  return disparadores.some((tema) => p.includes(tema));
}

const VACIAS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a", "en", "y", "o",
  "que", "como", "para", "por", "con", "sin", "me", "mi", "te", "tu", "se", "su", "es", "son",
  "esta", "este", "puedo", "quiero", "necesito", "hay", "the", "cuanto", "cuando", "donde", "quien",
]);

function palabrasClave(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length > 2 && !VACIAS.has(p));
}

export interface FuenteConocimiento {
  entradas: { id: string; title: string; body: string; keywords: string[] }[];
  faqs: { id: string; question: string; answer: string }[];
}

export interface RespuestaAsistente {
  id: string;
  texto: string;
  origen: "conocimiento" | "faq";
  puntuacion: number;
}

/**
 * Busca la mejor coincidencia en el material aprobado. Si nada supera el umbral
 * mínimo, devuelve null y la ruta deriva a una persona: es mejor decir «te
 * llamamos» que responder algo aproximado.
 */
export function buscarRespuesta(pregunta: string, fuente: FuenteConocimiento): RespuestaAsistente | null {
  const claves = palabrasClave(pregunta);
  if (!claves.length) return null;

  const candidatos: RespuestaAsistente[] = [];

  for (const entrada of fuente.entradas) {
    const texto = normalizar(`${entrada.title} ${entrada.body} ${entrada.keywords.join(" ")}`);
    const aciertos = claves.filter((c) => texto.includes(c)).length;
    const enPalabrasClave = entrada.keywords.some((k) => claves.includes(normalizar(k)));
    const puntuacion = aciertos + (enPalabrasClave ? 1.5 : 0);
    if (puntuacion > 0) {
      candidatos.push({ id: entrada.id, texto: entrada.body, origen: "conocimiento", puntuacion });
    }
  }

  for (const faq of fuente.faqs) {
    const texto = normalizar(`${faq.question} ${faq.answer}`);
    const aciertos = claves.filter((c) => texto.includes(c)).length;
    if (aciertos > 0) {
      candidatos.push({ id: faq.id, texto: faq.answer, origen: "faq", puntuacion: aciertos });
    }
  }

  if (!candidatos.length) return null;
  candidatos.sort((a, b) => b.puntuacion - a.puntuacion);
  const mejor = candidatos[0]!;

  // Umbral: con una sola palabra suelta coincidiendo, la respuesta suele ser
  // ruido. Preferimos derivar.
  const umbral = claves.length === 1 ? 1 : 1.5;
  return mejor.puntuacion >= umbral ? mejor : null;
}
