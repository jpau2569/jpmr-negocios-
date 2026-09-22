// ============================================================================
//  Oportunidades Únicas — alta rápida, seguimientos y tarjeta
// ----------------------------------------------------------------------------
//  Tres ayudas que no tocan la base de datos:
//
//  1. ALTA RÁPIDA: de unas notas sueltas («piso 3 hab en El Llano, 185k,
//     ascensor y terraza») a una ficha rellena y un anuncio redactado. Con
//     ANTHROPIC_API_KEY lo escribe Claude; sin ella, el extractor local. En
//     los dos casos rige la regla de la casa: LO QUE NO ESTÁ EN LAS NOTAS NO
//     SALE EN LA FICHA. Los números de la IA se comprueban contra el texto.
//
//  2. SEGUIMIENTOS: a quién le mandaste pisos hace días y no ha dicho nada,
//     con el recordatorio de WhatsApp ya escrito.
//
//  3. Los datos que pinta la TARJETA visual (la dibuja el navegador).
// ============================================================================

import { CARACTERISTICAS, CONTACTO, OPERACIONES } from "./oportunidades.js";

// ---------------------------------------------------------------------------
//  Utilidades de texto
// ---------------------------------------------------------------------------
const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const NUMEROS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};
const numeroPalabra = (p) => (/^\d+$/.test(p) ? Number(p) : NUMEROS[sinTildes(p)] ?? null);

export const CIUDADES_ASTURIAS = [
  "Oviedo", "Gijón", "Avilés", "Mieres", "Langreo", "Siero", "Pola de Siero", "Lugones", "Llanes", "Noreña",
  "Grado", "Cangas de Onís", "Ribadesella", "Villaviciosa", "Luarca", "Candás", "Piedras Blancas", "La Felguera",
  "Sama", "Pola de Lena", "Tineo", "Navia", "Llanera", "Posada", "Colloto", "Lugo de Llanera", "Salinas",
  "Castrillón", "Carreño", "Laviana", "Pola de Laviana", "Moreda", "Cudillero", "Pravia", "Nava", "Infiesto",
];

const TIPOS = [
  ["atico", "Ático"], ["duplex", "Dúplex"], ["chalet", "Chalet"], ["adosado", "Adosado"], ["casa", "Casa"],
  ["estudio", "Estudio"], ["apartamento", "Apartamento"], ["bajo", "Bajo"], ["local", "Local"],
  ["finca", "Finca"], ["piso", "Piso"],
];

// Palabras que delatan cada característica (sin tildes, en minúscula).
const PISTAS = {
  terraza: ["terraza"],
  ascensor: ["ascensor"],
  garaje: ["garaje", "plaza de garaje", "parking", "cochera", "aparcamiento"],
  trastero: ["trastero"],
  jardin: ["jardin"],
  piscina: ["piscina"],
  reformado: ["reformado", "reformada", "recien reformado", "a estrenar reforma"],
  amueblado: ["amueblado", "amueblada"],
  calefaccion: ["calefaccion"],
  exterior: ["exterior"],
  vistas: ["vistas"],
  "obra-nueva": ["obra nueva", "a estrenar"],
};

// ---------------------------------------------------------------------------
//  1a. Extractor local (sin IA)
// ---------------------------------------------------------------------------
export function extraerFicha(notas) {
  const original = String(notas || "").slice(0, 4000);
  const t = sinTildes(original);
  const ficha = {};

  // Operación
  ficha.operacion = /alquil|\/ ?mes\b|al mes\b|mensual/.test(t) ? "alquiler" : "venta";

  // Precio: «185.000 €», «185000 euros», «185k», «185 mil», «750 €/mes»
  let m = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,7})\s*(?:€|euros?\b|eur\b)/);
  if (m) ficha.precio = Number(m[1].replace(/[.\s]/g, ""));
  if (!ficha.precio) {
    m = t.match(/(\d{2,4}(?:[.,]\d{1,3})?)\s*(?:k\b|k€|mil\b)/);
    if (m) ficha.precio = Math.round(Number(m[1].replace(",", ".")) * 1000);
  }
  if (!ficha.precio) {
    m = t.match(/(?:precio|pide|piden|vale|por)\s*:?\s*(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})/);
    if (m) ficha.precio = Number(m[1].replace(/[.\s]/g, ""));
  }

  // Metros
  m = t.match(/(\d{2,4})(?:[.,]\d+)?\s*(?:m2|m²|mts?\b|metros)/);
  if (m) ficha.metros = Number(m[1]);

  // Habitaciones y baños (cifra o palabra)
  const cuenta = (re) => {
    const r = t.match(re);
    return r ? numeroPalabra(r[1]) : null;
  };
  const palabra = "(\\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)";
  ficha.habitaciones = cuenta(new RegExp(`${palabra}\\s*(?:hab\\b|habs\\b|habitacion|dormitorio|dorm\\b|cuartos?\\b)`));
  ficha.banos = cuenta(new RegExp(`${palabra}\\s*(?:banos?\\b|aseos?\\b)`));

  // Ciudad y zona
  const ciudad = [...CIUDADES_ASTURIAS].sort((a, b) => b.length - a.length)
    .find((c) => new RegExp(`\\b${sinTildes(c)}\\b`).test(t));
  if (ciudad) ficha.ciudad = ciudad;
  const MAY = "[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñü]+";
  let zona = original.match(new RegExp(`(?:zona|barrio)\\s+(?:de\\s+|del\\s+)?(${MAY}(?:\\s+(?:de\\s+)?${MAY}){0,2})`));
  zona = zona ? zona[1] : null;
  if (!zona) {
    const r = original.match(new RegExp(`\\ben\\s+((?:[Ee]l|[Ll]a|[Ll]os|[Ll]as)\\s+${MAY}(?:\\s+${MAY})?)`));
    if (r) zona = r[1][0].toUpperCase() + r[1].slice(1);
  }
  if (zona && (!ciudad || sinTildes(zona) !== sinTildes(ciudad))) ficha.zona = zona;

  // Características
  ficha.caracteristicas = Object.entries(PISTAS)
    .filter(([, pistas]) => pistas.some((p) => new RegExp(`\\b${p}`).test(t)))
    .filter(([id]) => !(id === "calefaccion" && /sin calefaccion/.test(t)) && !(id === "ascensor" && /sin ascensor/.test(t)))
    .map(([id]) => id);

  // Tipo y título
  const tipo = TIPOS.find(([k]) => new RegExp(`\\b${k}`).test(t))?.[1] || "Piso";
  ficha.tipo = tipo;
  const donde = [ficha.zona, ficha.ciudad].filter(Boolean).join(", ");
  ficha.titulo = [
    tipo,
    ficha.habitaciones ? `de ${ficha.habitaciones} ${ficha.habitaciones === 1 ? "habitación" : "habitaciones"}` : null,
    donde ? `en ${donde}` : null,
  ].filter(Boolean).join(" ").slice(0, 120);

  for (const k of Object.keys(ficha)) if (ficha[k] === null || ficha[k] === undefined) delete ficha[k];
  return ficha;
}

/** Anuncio sobrio a partir de los datos: solo frases con datos que existen. */
export function anuncioLocal(f) {
  const nombre = (id) => (CARACTERISTICAS.find((c) => c.id === id)?.nombre || id).toLowerCase();
  const tipo = f.tipo || "Inmueble";
  const donde = [f.zona, f.ciudad].filter(Boolean).join(", ");
  const frases = [];
  frases.push(`${tipo}${f.operacion === "alquiler" ? " en alquiler" : " en venta"}${donde ? ` en ${donde}` : ""}${f.metros ? `, con ${f.metros} m²` : ""}.`);
  const piezas = [
    f.habitaciones ? `${f.habitaciones} ${f.habitaciones === 1 ? "habitación" : "habitaciones"}` : null,
    f.banos ? `${f.banos} ${f.banos === 1 ? "baño" : "baños"}` : null,
  ].filter(Boolean);
  if (piezas.length) frases.push(`Tiene ${piezas.join(" y ")}.`);
  const car = (f.caracteristicas || []).map(nombre);
  if (car.length) frases.push(`Características: ${car.length > 1 ? car.slice(0, -1).join(", ") + " y " + car.at(-1) : car[0]}.`);
  if (f.precio) {
    const p = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(f.precio);
    frases.push(f.operacion === "alquiler" ? `Renta: ${p} €/mes.` : `Precio: ${p} €.`);
  }
  frases.push("Pide más información o una visita sin compromiso por WhatsApp.");
  return frases.join(" ");
}

/** Qué falta para que el anuncio venda: se enseña para que Pau lo complete. */
export function datosQueFaltan(f) {
  const faltan = [];
  if (!f.precio) faltan.push("precio");
  if (!f.ciudad) faltan.push("ciudad");
  if (!f.metros) faltan.push("metros");
  if (!f.habitaciones) faltan.push("habitaciones");
  if (!f.banos) faltan.push("baños");
  return faltan;
}

// ---------------------------------------------------------------------------
//  1b. Lo que devuelve la IA, pasado por el filtro de honestidad
// ---------------------------------------------------------------------------
export const PROMPT_ALTA = `Eres el redactor de fichas de una agencia inmobiliaria de Asturias (España).
Te paso las notas sueltas de un agente sobre un inmueble. Responde llamando a la herramienta rellenar_ficha (o, si no puedes, con SOLO un objeto JSON) con esta forma:
{"titulo": string, "operacion": "venta"|"alquiler", "precio": number|null, "ciudad": string|null, "zona": string|null,
 "habitaciones": number|null, "banos": number|null, "metros": number|null,
 "caracteristicas": string[], "descripcion": string, "faltan": string[]}

Reglas, sin excepción:
- NO INVENTES NADA. Si un dato no está en las notas, va null (o fuera de la lista). Nada de vistas, luz, orientación, planta, gastos, estado ni barrio que no aparezcan.
- "caracteristicas" solo puede contener estos identificadores: ${CARACTERISTICAS.map((c) => c.id).join(", ")}.
- "titulo": comercial y concreto, máximo 70 caracteres, sin mayúsculas gritonas ni emojis. Ej.: "Piso de 3 habitaciones con terraza en El Llano".
- "descripcion": anuncio de 80 a 150 palabras en español de España, tono profesional y cercano, frases cortas, sin exclamaciones, sin superlativos vacíos ("increíble", "único", "espectacular"). Usa solo los hechos de las notas; puedes ordenarlos y darles forma, pero no añadas valoraciones que no estén en ellas (nada de "buena distribución", "luminoso", "ideal para familias", "bien comunicado"). Termina invitando a pedir información o visita.
- "faltan": los datos importantes para vender que NO están en las notas (por ejemplo: precio, metros, planta, ascensor, estado, gastos de comunidad, orientación, certificado energético).
- "precio" en euros como número (185k → 185000). En alquiler, la renta mensual.`;

// Un número de la IA solo vale si está en las notas (en cifra o, para 185k,
// como 185), o si el extractor local ha sacado el mismo.
function numeroAvalado(n, notas, local) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return false;
  n = Math.round(Number(n));
  if (local !== undefined && local === n) return true;
  const plano = sinTildes(notas).replace(/[.\s]/g, "");
  if (plano.includes(String(n))) return true;
  if (n >= 1000 && n % 1000 === 0 && new RegExp(`${n / 1000}(k|mil)`).test(plano)) return true;
  return false;
}

export function normalizarAltaIA(bruto, notas) {
  const local = extraerFicha(notas);
  if (!bruto || typeof bruto !== "object") return null;
  const f = {};
  const txt = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

  f.titulo = txt(bruto.titulo, 120) || local.titulo;
  f.operacion = OPERACIONES.includes(bruto.operacion) ? bruto.operacion : local.operacion;
  for (const k of ["precio", "habitaciones", "banos", "metros"]) {
    if (numeroAvalado(bruto[k], notas, local[k])) f[k] = Math.round(Number(bruto[k]));
    else if (local[k]) f[k] = local[k];
  }
  // Ciudad y zona: solo si aparecen en las notas.
  const t = sinTildes(notas);
  for (const k of ["ciudad", "zona"]) {
    const v = txt(bruto[k], 80);
    if (v && t.includes(sinTildes(v))) f[k] = v;
    else if (local[k]) f[k] = local[k];
  }
  const ids = new Set(CARACTERISTICAS.map((c) => c.id));
  // Una característica de la IA solo entra si las notas la mencionan: si no,
  // la IA podría «regalar» unas vistas o una piscina que no existen.
  const mencionada = (id) => (local.caracteristicas || []).includes(id) ||
    (PISTAS[id] || []).some((p) => t.includes(p)) ||
    t.includes(sinTildes(CARACTERISTICAS.find((c) => c.id === id)?.nombre || id));
  f.caracteristicas = [...new Set([...(Array.isArray(bruto.caracteristicas) ? bruto.caracteristicas : []), ...(local.caracteristicas || [])])]
    .filter((c) => ids.has(c) && mencionada(c));
  f.descripcion = txt(bruto.descripcion, 4000) || anuncioLocal({ ...local, ...f });
  f.faltan = (Array.isArray(bruto.faltan) ? bruto.faltan : []).map((x) => txt(x, 60)).filter(Boolean).slice(0, 8);
  if (!f.faltan.length) f.faltan = datosQueFaltan(f);
  return f;
}

export function altaLocal(notas) {
  const f = extraerFicha(notas);
  return { ...f, descripcion: anuncioLocal(f), faltan: datosQueFaltan(f) };
}

/** Saca el primer objeto JSON de una respuesta del modelo. */
export function extraerJSON(bruto) {
  const s = String(bruto || "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// ---------------------------------------------------------------------------
//  2. Seguimientos
// ---------------------------------------------------------------------------
//  Un cliente pide seguimiento cuando le mandaste algo hace DIAS_SEGUIMIENTO
//  días o más y desde entonces no ha contestado nada en su portal.
export const DIAS_SEGUIMIENTO = 3;
const DIA = 86400000;

export function pendientesSeguimiento(clientes, respuestas, ahora = Date.now(), dias = DIAS_SEGUIMIENTO) {
  const ultimaRespuesta = {};
  for (const r of respuestas || []) {
    const t = new Date(r.creado).getTime();
    if (!ultimaRespuesta[r.cliente_id] || t > ultimaRespuesta[r.cliente_id]) ultimaRespuesta[r.cliente_id] = t;
  }
  return (clientes || [])
    .filter((c) => !c.anonimizado && (c.inmuebles_autorizados || []).length && c.ultimo_contacto)
    .map((c) => {
      const envio = new Date(c.ultimo_contacto).getTime();
      return { cliente: c, dias: Math.floor((ahora - envio) / DIA), contesto: (ultimaRespuesta[c.id] || 0) > envio };
    })
    .filter((s) => !s.contesto && s.dias >= dias)
    .sort((a, b) => b.dias - a.dias);
}

export function mensajeSeguimiento({ cliente, dias, enviados = 0, firma }) {
  const n = cliente?.nombre ? ` ${cliente.nombre}` : "";
  const agente = firma?.agente || "Pau";
  const cosa = enviados === 1 ? "el piso que te pasé" : "los pisos que te pasé";
  if (dias >= 10) {
    return `Hola${n}, soy ${agente}. ¿Sigues buscando? Si ha cambiado algo (zona, presupuesto, fechas) dímelo y te afino la búsqueda. Si ya lo tienes resuelto, también me ayuda saberlo. ¡Gracias!`;
  }
  if (dias >= 6) {
    return `Hola${n}, soy ${agente}. Te escribo por ${cosa} hace unos días. ¿Alguno te encaja lo suficiente para verlo? Esta semana tengo huecos para visitas.`;
  }
  return `Hola${n}, soy ${agente}. ¿Pudiste echar un vistazo a ${cosa}? Si alguno te gusta, te organizo la visita cuando mejor te venga.`;
}

// ---------------------------------------------------------------------------
//  3. Tarjeta visual: los textos que lleva (el dibujo lo hace el navegador)
// ---------------------------------------------------------------------------
export function datosTarjeta(inm) {
  const precio = inm.precio
    ? new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(inm.precio) + " €" + (inm.operacion === "alquiler" ? "/mes" : "")
    : "Consultar precio";
  return {
    precio,
    titulo: String(inm.titulo || "").slice(0, 80),
    donde: [inm.zona, inm.ciudad].filter(Boolean).join(", "),
    datos: [
      inm.habitaciones ? `${inm.habitaciones} hab` : null,
      inm.banos ? `${inm.banos} ${inm.banos === 1 ? "baño" : "baños"}` : null,
      inm.metros ? `${inm.metros} m²` : null,
    ].filter(Boolean),
    extras: (inm.caracteristicas || []).slice(0, 3).map((id) => CARACTERISTICAS.find((c) => c.id === id)?.nombre || id),
    whatsapp: CONTACTO.whatsapp.replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4"),
    operacion: inm.operacion === "alquiler" ? "EN ALQUILER" : "EN VENTA",
  };
}

// ---------------------------------------------------------------------------
//  4. Vídeo propio del inmueble (se sube del móvil directo al almacén)
// ---------------------------------------------------------------------------
//  50 MB es el máximo por archivo del plan gratuito de Supabase: un minuto
//  grabado en 1080p cabe; en 4K, no.
export const BUCKET_VIDEOS = "videos";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const TIPOS_VIDEO = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

export function validarVideo({ tipo, tamano } = {}) {
  const ext = TIPOS_VIDEO[String(tipo || "").toLowerCase()];
  if (!ext) return { ok: false, error: "Ese archivo no es un vídeo MP4, MOV o WebM." };
  const n = Number(tamano);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "El vídeo está vacío." };
  if (n > MAX_VIDEO_BYTES) {
    return { ok: false, error: `El vídeo pesa ${Math.round(n / 1048576)} MB y el máximo es 50 MB. Grábalo en 1080p o recórtalo a menos de un minuto.` };
  }
  return { ok: true, ext };
}

export function rutaVideo(inmuebleId, ext, aleatorio = () => Math.random()) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  let r = "";
  for (let i = 0; i < 10; i++) r += abc[Math.floor(aleatorio() * abc.length)];
  return `${String(inmuebleId).replace(/[^a-zA-Z0-9-]/g, "")}/${r}.${ext}`;
}

/** Si un video_url es un vídeo subido a nuestro almacén, su ruta dentro del bucket. */
export function rutaVideoPropio(url, supabaseUrl) {
  const base = `${String(supabaseUrl || "").replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET_VIDEOS}/`;
  return url && supabaseUrl && String(url).startsWith(base) ? String(url).slice(base.length) : null;
}

/** Esquema para que Claude devuelva la ficha como herramienta (JSON garantizado). */
export const HERRAMIENTA_FICHA = {
  name: "rellenar_ficha",
  description: "Devuelve la ficha del inmueble extraída de las notas del agente.",
  input_schema: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      operacion: { type: "string", enum: ["venta", "alquiler"] },
      precio: { type: ["number", "null"] },
      ciudad: { type: ["string", "null"] },
      zona: { type: ["string", "null"] },
      habitaciones: { type: ["number", "null"] },
      banos: { type: ["number", "null"] },
      metros: { type: ["number", "null"] },
      caracteristicas: { type: "array", items: { type: "string", enum: CARACTERISTICAS.map((c) => c.id) } },
      descripcion: { type: "string" },
      faltan: { type: "array", items: { type: "string" } },
    },
    required: ["titulo", "operacion", "caracteristicas", "descripcion", "faltan"],
  },
};
