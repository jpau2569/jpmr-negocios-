// ============================================================================
//  CASTRESANA LUXURY MOTION — catálogos, validación y estudio creativo local
// ----------------------------------------------------------------------------
//  Módulo compartido por `api/luxury-motion.js` (backend) y por los tests.
//  Sin dependencias: Node puro, ESM.
//
//  Hace tres cosas:
//    1. CATÁLOGOS — las opciones del formulario (tipos, características,
//       clientes, objetivos, plataformas, duraciones, estilos y generadores)
//       con su vocabulario visual en español y en inglés.
//       `castresana-luxury-motion.html` repite estos valores en su formulario y
//       el test `test/luxury-motion.test.mjs` vigila que no se desincronicen.
//    2. normalizarBriefing() — sanea lo que llega del navegador: solo valores
//       del catálogo, textos acotados y números creíbles. Nada de texto libre
//       sin recortar llega al modelo.
//    3. componerCampana() — el "modo estudio": genera la campaña completa sin
//       llamar a ninguna IA. Es el motor de respaldo cuando no hay
//       ANTHROPIC_API_KEY o la API falla, y garantiza que la herramienta
//       siempre devuelve algo usable.
//
//  REGLA DE ORO (la misma que el prompt maestro de agentes/luxury-motion.md):
//  nunca se inventan habitaciones, metros, vistas, piscina, terraza,
//  materiales ni servicios. Todo lo que aparece en la campaña sale del
//  briefing; lo que falta se dice en `notas`, no se rellena.
// ============================================================================

// ---------------------------------------------------------------------------
//  Identidad de marca (se repite al final de cada campaña)
// ---------------------------------------------------------------------------
export const MARCA = {
  nombre: "Asesoría Castresana · Gestión Inmobiliaria",
  web: "asesoriacastresana.com",
  ciudad: "Oviedo, Asturias",
  telefonos: ["985 210 468", "689 929 926", "672 775 721"],
  cierres: [
    "Solicita tu visita privada",
    "Descubre tu próximo hogar",
    "Asesoría Castresana · Gestión Inmobiliaria",
    "asesoriacastresana.com",
  ],
};

// Negative prompt común a todos los generadores: lo que NUNCA debe aparecer.
export const NEGATIVE_PROMPT = [
  "texto legible, rótulos, subtítulos, marcas de agua, logotipos inventados",
  "caras reconocibles, personas identificables, rostros deformes, ojos asimétricos",
  "manos con dedos de más o de menos, extremidades imposibles",
  "arquitectura imposible, habitaciones infinitas, puertas o ventanas que cambian de sitio",
  "muebles deformados, objetos flotantes, perspectivas imposibles, suelos ondulados",
  "estancias, piscinas, terrazas, vistas o materiales que no estén en el briefing",
  "colores saturados de catálogo, HDR agresivo, viñeteado fuerte, sobreexposición",
  "efecto ojo de pez, distorsión de lente extrema, cámara temblorosa",
  "estética de videojuego, render 3D evidente, plástico, piel de cera",
  "nieve, tormenta o estaciones que no correspondan a la hora indicada",
].join(", ");

export const NEGATIVE_PROMPT_EN = [
  "readable text, on-screen captions, subtitles, watermarks, invented logos",
  "recognizable faces, identifiable people, deformed faces, asymmetric eyes",
  "extra or missing fingers, impossible limbs",
  "impossible architecture, endless rooms, doors or windows that move between shots",
  "warped furniture, floating objects, impossible perspective, wavy floors",
  "rooms, pools, terraces, views or materials not present in the brief",
  "oversaturated catalogue colors, aggressive HDR, heavy vignette, blown highlights",
  "fisheye, extreme lens distortion, shaky camera",
  "video-game look, obvious 3D render, plastic or waxy skin",
  "snow, storms or seasons that contradict the stated time of day",
].join(", ");

// ---------------------------------------------------------------------------
//  1. CATÁLOGOS
// ---------------------------------------------------------------------------

// `exterior`: si tiene sentido abrir con dron / plano exterior.
// `piezas`: vocabulario visual honesto — elementos que existen en cualquier
// inmueble de ese tipo y que no inventan nada (un umbral, un pasillo, la luz
// entrando). Se usan para rellenar escenas cuando el briefing es escueto.
export const TIPOS = [
  { id: "piso", nombre: "Piso", en: "apartment", exterior: false,
    piezas: ["el portal y el rellano", "el recibidor al abrir la puerta", "el paso de una estancia a otra", "la luz cruzando el salón"],
    piezasEn: ["the building entrance", "the hallway as the door opens", "the transition between rooms", "light crossing the living room"] },
  { id: "atico", nombre: "Ático", en: "penthouse", exterior: true,
    piezas: ["la subida al último piso", "el umbral hacia el exterior", "la línea del cielo sobre la ciudad", "el interior recogido al atardecer"],
    piezasEn: ["the climb to the top floor", "the threshold to the outdoor space", "the skyline above the city", "the quiet interior at dusk"] },
  { id: "chalet", nombre: "Chalet", en: "detached house", exterior: true,
    piezas: ["la aproximación desde el acceso", "la fachada completa", "el paso de fuera a dentro", "la planta principal en silencio"],
    piezasEn: ["the approach from the driveway", "the full façade", "the move from outside to inside", "the main floor in silence"] },
  { id: "casa", nombre: "Casa", en: "house", exterior: true,
    piezas: ["la puerta de entrada", "el recorrido de la planta baja", "la escalera", "la luz de la tarde en las estancias"],
    piezasEn: ["the front door", "the ground-floor walkthrough", "the staircase", "afternoon light through the rooms"] },
  { id: "casa-rural", nombre: "Casa rural", en: "country house", exterior: true,
    piezas: ["el camino de llegada", "la piedra y la madera de la fachada", "el interior cálido", "el entorno abriéndose alrededor"],
    piezasEn: ["the approach road", "the stone and timber of the façade", "the warm interior", "the surroundings opening up"] },
  { id: "local", nombre: "Local comercial", en: "retail premises", exterior: true,
    piezas: ["el escaparate desde la acera", "el flujo de gente delante", "el espacio diáfano por dentro", "la altura libre"],
    piezasEn: ["the shopfront from the pavement", "the foot traffic outside", "the open floor plate inside", "the ceiling height"] },
  { id: "oficina", nombre: "Oficina", en: "office", exterior: false,
    piezas: ["el acceso al edificio", "el espacio de trabajo vacío", "la luz sobre las mesas", "las zonas comunes"],
    piezasEn: ["the building access", "the empty workspace", "light across the desks", "the common areas"] },
  { id: "terreno", nombre: "Terreno", en: "plot of land", exterior: true,
    piezas: ["los límites de la parcela desde el aire", "la orientación del sol sobre el suelo", "el horizonte desde el centro de la parcela", "el acceso rodado"],
    piezasEn: ["the plot boundaries from the air", "the sun's orientation across the ground", "the horizon from the middle of the plot", "the road access"] },
  { id: "edificio", nombre: "Edificio", en: "building", exterior: true,
    piezas: ["el volumen completo desde la calle", "el portal", "la escalera común", "la última planta"],
    piezasEn: ["the full volume from the street", "the main entrance", "the common staircase", "the top floor"] },
  { id: "inversion", nombre: "Inversión", en: "investment asset", exterior: false,
    piezas: ["el activo en su contexto urbano", "el estado del espacio", "los accesos", "el entorno que sostiene la demanda"],
    piezasEn: ["the asset in its urban context", "the condition of the space", "the accesses", "the surroundings that sustain demand"] },
];

// Cada característica aporta UNA escena concreta y su fragmento de prompt.
export const CARACTERISTICAS = [
  { id: "terraza", nombre: "Terraza", en: "terrace",
    escena: "la terraza, filmada desde dentro hacia fuera",
    prompt: "la terraza del inmueble, sin mobiliario de más que el que ya existe" },
  { id: "vistas", nombre: "Vistas", en: "views",
    escena: "las vistas desde la ventana, reveladas poco a poco",
    prompt: "las vistas reales desde el hueco de la ventana, sin exagerar el horizonte" },
  { id: "garaje", nombre: "Garaje", en: "garage",
    escena: "la plaza de garaje y el acceso al vehículo",
    prompt: "la plaza de garaje, iluminada de forma realista" },
  { id: "jardin", nombre: "Jardín", en: "garden",
    escena: "el jardín recorrido a ras de suelo",
    prompt: "el jardín con vegetación creíble para el clima del norte de España" },
  { id: "piscina", nombre: "Piscina", en: "swimming pool",
    escena: "la piscina, con el agua quieta y un reflejo limpio",
    prompt: "la piscina del inmueble, agua en calma, sin bañistas" },
  { id: "ascensor", nombre: "Ascensor", en: "lift",
    escena: "la llegada del ascensor a la planta",
    prompt: "el ascensor del edificio y el rellano" },
  { id: "reformado", nombre: "Reformado", en: "renovated",
    escena: "los acabados nuevos en detalle macro",
    prompt: "acabados recientes y superficies cuidadas, sin describir materiales concretos" },
  { id: "luz-natural", nombre: "Luz natural", en: "natural light",
    escena: "la luz entrando y recorriendo el suelo",
    prompt: "luz natural directa entrando por los huecos, polvo suspendido apenas visible" },
  { id: "centrico", nombre: "Ubicación céntrica", en: "central location",
    escena: "la calle a pie, con el ritmo de la ciudad alrededor",
    prompt: "el entorno urbano inmediato, sin marcas comerciales reconocibles" },
  { id: "colegios", nombre: "Cerca de colegios", en: "near schools",
    escena: "el trayecto corto a pie por el barrio",
    prompt: "aceras y recorridos peatonales del barrio, sin menores identificables" },
  { id: "hospitales", nombre: "Cerca de hospitales", en: "near hospitals",
    escena: "la conexión rodada desde la zona",
    prompt: "vías de acceso de la zona, sin señalética legible" },
  { id: "naturaleza", nombre: "Cerca de naturaleza", en: "near nature",
    escena: "el verde asturiano abriéndose detrás del inmueble",
    prompt: "paisaje verde del norte de España, niebla baja creíble" },
  { id: "rentable", nombre: "Inversión rentable", en: "profitable investment",
    escena: "planos limpios y ordenados del activo, ritmo editorial",
    prompt: "composición sobria y simétrica, lectura de activo patrimonial" },
];

export const CLIENTES = [
  { id: "pareja-joven", nombre: "Pareja joven", en: "young couple",
    perfil: "Primera compra en pareja. Comparan mucho, deciden rápido cuando algo encaja y les preocupa el esfuerzo mensual.",
    deseo: "empezar algo propio sin equivocarse", tono: "cercano, optimista y concreto" },
  { id: "familia", nombre: "Familia", en: "family",
    perfil: "Buscan que el día a día sea más fácil: espacio, rutinas cortas y un entorno tranquilo.",
    deseo: "que los días dejen de ser una carrera", tono: "cálido, tranquilo y práctico" },
  { id: "premium", nombre: "Comprador premium", en: "premium buyer",
    perfil: "Ya tiene vivienda. Compra criterio, discreción y calidad; no necesita que le convenzan, necesita que le respeten el tiempo.",
    deseo: "algo que no se encuentra abierto al público", tono: "sobrio, preciso y sin adjetivos gratuitos" },
  { id: "inversor", nombre: "Inversor", en: "investor",
    perfil: "Mira números antes que fotos: precio de entrada, demanda de la zona y salida.",
    deseo: "una decisión defendible con datos", tono: "directo, analítico y sin promesas" },
  { id: "internacional", nombre: "Comprador internacional", en: "international buyer",
    perfil: "Compra a distancia. Necesita entender el entorno y confiar en quien le acompaña.",
    deseo: "entender dónde está comprando", tono: "claro, hospitalario y muy visual" },
  { id: "primera-vivienda", nombre: "Primera vivienda", en: "first-time buyer",
    perfil: "Primera operación de su vida. Ilusión alta y miedo a los papeles.",
    deseo: "dar el paso acompañado", tono: "didáctico, cercano y tranquilizador" },
  { id: "segunda-residencia", nombre: "Segunda residencia", en: "second home",
    perfil: "Busca un sitio al que volver. Decide con la emoción y confirma con la cabeza.",
    deseo: "un lugar donde el tiempo vaya más despacio", tono: "evocador y sereno" },
  { id: "jubilacion", nombre: "Jubilación", en: "retirement",
    perfil: "Quiere comodidad, accesos fáciles y servicios cerca. Valora que todo esté en regla.",
    deseo: "vivir con todo a mano y sin sobresaltos", tono: "respetuoso, claro y sin prisa" },
];

export const OBJETIVOS = [
  { id: "vender", nombre: "Vender inmueble", cta: "Solicita tu visita privada",
    foco: "que el comprador correcto pida ver el inmueble esta misma semana" },
  { id: "visitas", nombre: "Conseguir visitas", cta: "Solicita tu visita privada",
    foco: "convertir la curiosidad en una visita agendada, sin fricción" },
  { id: "captar", nombre: "Captar propietarios", cta: "Pide la valoración de tu inmueble",
    foco: "que un propietario vea cómo trabajamos un inmueble y quiera lo mismo para el suyo" },
  { id: "marca", nombre: "Crear marca", cta: "Descubre tu próximo hogar",
    foco: "que Asesoría Castresana se reconozca por criterio y por cómo mira los inmuebles" },
  { id: "zona", nombre: "Promocionar zona", cta: "Descubre tu próximo hogar",
    foco: "que la zona se entienda como un buen sitio para vivir o invertir" },
  { id: "redes", nombre: "Anuncio para redes sociales", cta: "Solicita tu visita privada",
    foco: "parar el scroll en menos de dos segundos y sostener la atención hasta el cierre" },
];

export const PLATAFORMAS = [
  { id: "ig-reel", nombre: "Instagram Reel 9:16", ratio: "9:16", en: "vertical 9:16",
    ritmo: "cortes cada 1,5-2,5 s; el primer plano decide todo",
    seguridad: "deja libres 250 px arriba y 420 px abajo: ahí van la interfaz y el pie de Instagram" },
  { id: "tiktok", nombre: "TikTok 9:16", ratio: "9:16", en: "vertical 9:16",
    ritmo: "hook hablado o visual en el primer segundo; cortes cada 1,5-2 s",
    seguridad: "el lateral derecho y los 500 px inferiores los tapa la interfaz de TikTok" },
  { id: "yt-short", nombre: "YouTube Short 9:16", ratio: "9:16", en: "vertical 9:16",
    ritmo: "arranque con la promesa clara; cortes cada 2 s",
    seguridad: "evita texto en los 300 px inferiores (título y canal)" },
  { id: "yt-16-9", nombre: "YouTube 16:9", ratio: "16:9", en: "cinematic 16:9",
    ritmo: "planos más largos, de 3 a 5 s; deja respirar cada espacio",
    seguridad: "títulos en el tercio inferior, con margen del 10 % en los bordes" },
  { id: "pantalla", nombre: "Pantalla inmobiliaria 16:9", ratio: "16:9", en: "cinematic 16:9",
    ritmo: "planos largos y suaves: se ve de paso y sin sonido",
    seguridad: "todo tiene que entenderse en silencio y a tres metros de distancia" },
  { id: "meta-ads", nombre: "Campaña Meta Ads 4:5", ratio: "4:5", en: "vertical 4:5",
    ritmo: "mensaje completo en los primeros 6 s por si no ven el resto",
    seguridad: "menos del 20 % de la superficie con texto quemado" },
];

// Nº de escenas por duración: ritmo de vídeo inmobiliario premium.
export const DURACIONES = [
  { id: "15", segundos: 15, nombre: "15 segundos", escenas: 4 },
  { id: "30", segundos: 30, nombre: "30 segundos", escenas: 6 },
  { id: "45", segundos: 45, nombre: "45 segundos", escenas: 8 },
  { id: "60", segundos: 60, nombre: "60 segundos", escenas: 10 },
];

export const ESTILOS = [
  { id: "cine-lujo", nombre: "Cine de lujo",
    luz: "luz dorada de última hora, sombras largas y limpias",
    atmosfera: "calma, silencio, aire quieto",
    lente: "anamórfico 40 mm, T2.0, profundidad de campo corta",
    paleta: "grafito, champán y blanco cálido",
    ritmo: "movimientos lentos y continuos, nada brusco",
    movimientos: ["dolly in muy lento", "travelling lateral", "paneo lento", "gimbal interior fluido"],
    hook: "Un plano que retiene la respiración antes de mostrar nada.",
    en: { look: "luxury cinema, subtle film grain, anamorphic", luz: "golden hour light, long clean shadows", lente: "40mm anamorphic, T2.0, shallow depth of field" } },
  { id: "arquitectura-editorial", nombre: "Arquitectura editorial",
    luz: "luz difusa de día nublado, sin sombras duras",
    atmosfera: "orden, geometría, precisión",
    lente: "tilt-shift 24 mm, líneas verticales corregidas",
    paleta: "gris piedra, blanco roto y madera fría",
    ritmo: "planos fijos o casi fijos, encadenados por corte seco",
    movimientos: ["plano fijo con micro-dolly", "plano cenital", "travelling frontal", "tilt up lento"],
    hook: "Una composición tan limpia que parece una página de revista.",
    en: { look: "architectural editorial photography, magazine spread", luz: "soft diffused overcast light, no harsh shadows", lente: "24mm tilt-shift, corrected verticals" } },
  { id: "emocional-familiar", nombre: "Emocional y familiar",
    luz: "luz de mañana entrando por la ventana, cálida y suave",
    atmosfera: "vida cotidiana, calidez, cosas sencillas",
    lente: "35 mm, T1.8, cercano y humano",
    paleta: "blanco cálido, madera clara y verdes suaves",
    ritmo: "cámara en mano muy estabilizada, como una mirada",
    movimientos: ["gimbal interior fluido", "cámara a ras de suelo", "paneo lento", "dolly in muy lento"],
    hook: "Un gesto pequeño que cualquiera reconoce de su propia casa.",
    en: { look: "warm documentary lifestyle, gentle handheld", luz: "soft morning window light", lente: "35mm, T1.8, intimate" } },
  { id: "lifestyle", nombre: "Lifestyle aspiracional",
    luz: "media tarde luminosa, contraluces suaves",
    atmosfera: "ligereza, tiempo libre, aire",
    lente: "50 mm, T2.0, fondos desenfocados",
    paleta: "champán, crema y azul lejano",
    ritmo: "encadenados suaves, movimiento continuo",
    movimientos: ["travelling lateral", "gimbal interior fluido", "dolly in muy lento", "dron ascendente"],
    hook: "La sensación de un día que no tiene prisa.",
    en: { look: "aspirational lifestyle film, airy and clean", luz: "bright late-afternoon light, soft backlight", lente: "50mm, T2.0, creamy bokeh" } },
  { id: "asturias", nombre: "Asturias natural y elegante",
    luz: "primera hora, niebla baja disolviéndose, verde húmedo",
    atmosfera: "silencio del norte, aire limpio, autenticidad",
    lente: "35 mm, T2.2, contraste bajo y natural",
    paleta: "verde profundo, piedra gris y luz blanca fría",
    ritmo: "planos amplios largos alternados con detalles cercanos",
    movimientos: ["dron ascendente", "dron orbital lento", "paneo lento", "cámara a ras de suelo"],
    hook: "El norte mostrándose sin adornos: verde, piedra y silencio.",
    en: { look: "northern Spain nature cinematography, understated elegance", luz: "early morning, low mist lifting, wet green", lente: "35mm, T2.2, low natural contrast" } },
  { id: "minimalista", nombre: "Minimalista sofisticado",
    luz: "luz lateral controlada, fondos limpios",
    atmosfera: "vacío intencionado, calma absoluta",
    lente: "50 mm, T2.8, composición centrada",
    paleta: "blanco, grafito y un único acento champán",
    ritmo: "muy pocos planos, cada uno sostenido",
    movimientos: ["plano fijo con micro-dolly", "dolly in muy lento", "paneo lento", "plano cenital"],
    hook: "Un solo elemento en cuadro y todo el espacio alrededor.",
    en: { look: "minimalist sophisticated film, negative space", luz: "controlled side light, clean backgrounds", lente: "50mm, T2.8, centered composition" } },
  { id: "inversion", nombre: "Inversión y rentabilidad",
    luz: "luz neutra de día, lectura clara de cada espacio",
    atmosfera: "criterio, orden, datos",
    lente: "28 mm, T4.0, todo enfocado",
    paleta: "grafito, gris piedra y champán como acento de dato",
    ritmo: "planos informativos de 3 s, encadenados con lógica",
    movimientos: ["travelling frontal", "plano cenital", "plano fijo con micro-dolly", "dron orbital lento"],
    hook: "Un activo mirado como se mira un balance: sin ruido.",
    en: { look: "financial editorial, clean informative framing", luz: "neutral daylight, even exposure", lente: "28mm, T4.0, deep focus" } },
  { id: "misterioso", nombre: "Misterioso y cinematográfico",
    luz: "luz baja de atardecer o interior de noche, claroscuro",
    atmosfera: "intriga contenida, elegancia oscura",
    lente: "anamórfico 50 mm, T1.8, negros profundos",
    paleta: "azul noche, grafito y un filo dorado",
    ritmo: "revelaciones parciales, el espacio se descubre tarde",
    movimientos: ["dolly in muy lento", "cámara a ras de suelo", "paneo lento", "travelling lateral"],
    hook: "Se intuye antes de verse: primero la luz, después el espacio.",
    en: { look: "moody cinematic, deep blacks, chiaroscuro", luz: "low dusk light or night interior", lente: "50mm anamorphic, T1.8" } },
  { id: "viral", nombre: "Viral y rompedor",
    luz: "contraste alto y limpio, colores reales pero vivos",
    atmosfera: "energía, sorpresa, ritmo",
    lente: "24 mm, T2.8, planos cercanos y dinámicos",
    paleta: "grafito con acento champán muy marcado",
    ritmo: "corte cada 1-1,5 s, transiciones por movimiento",
    movimientos: ["travelling frontal", "whip pan de transición", "cámara a ras de suelo", "dron ascendente"],
    hook: "Un contraste que obliga a parar el dedo en el primer segundo.",
    en: { look: "high-energy social video, punchy but realistic", luz: "high clean contrast, true colors", lente: "24mm, T2.8, dynamic close framing" } },
];

// Guía por generador: cada motor pide el prompt de una forma distinta.
export const GENERADORES = [
  { id: "universal", nombre: "Prompt universal",
    guia: "Prompt descriptivo completo, válido para cualquier motor. Una escena por bloque, con cámara, luz y lente explícitas." },
  { id: "veo", nombre: "Google Veo",
    guia: "Veo responde a lenguaje natural cinematográfico. Describe la escena como una indicación a un director de fotografía; pon el movimiento de cámara al principio de la frase y no pidas texto en pantalla." },
  { id: "sora", nombre: "Sora",
    guia: "Sora mantiene mejor la coherencia con un prompt narrado por planos consecutivos. Numera los planos y da continuidad entre ellos (misma hora, misma luz, mismo espacio)." },
  { id: "kling", nombre: "Kling",
    guia: "Kling funciona mejor con prompts cortos y concretos por plano, y con el negative prompt siempre relleno. Genera plano a plano y monta después." },
  { id: "runway", nombre: "Runway",
    guia: "En Runway (Gen-3) empieza el prompt por el movimiento de cámara, sigue con el sujeto y termina con la luz. Frases cortas separadas por comas." },
  { id: "pika", nombre: "Pika",
    guia: "Pika prefiere prompts breves con un único movimiento claro por clip. Divide el guion en clips de 3-4 s y encadénalos en edición." },
];

// Movimientos de cámara admitidos (el guion solo usa estos).
export const MOVIMIENTOS_EN = {
  "dron ascendente": "rising drone shot",
  "dron orbital lento": "slow orbital drone shot",
  "travelling lateral": "lateral tracking shot",
  "travelling frontal": "forward tracking shot",
  "dolly in muy lento": "very slow dolly in",
  "paneo lento": "slow pan",
  "cámara a ras de suelo": "low-angle ground-level shot",
  "plano cenital": "top-down aerial shot",
  "gimbal interior fluido": "fluid interior gimbal move",
  "plano fijo con micro-dolly": "locked-off shot with micro dolly",
  "tilt up lento": "slow tilt up",
  "whip pan de transición": "whip pan transition",
};

// ---------------------------------------------------------------------------
//  2. VALIDACIÓN DEL BRIEFING
// ---------------------------------------------------------------------------

const busca = (lista, id) => lista.find((x) => x.id === String(id ?? "").trim().toLowerCase());

function limpiar(valor, max) {
  return String(valor ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function entero(valor, max) {
  const bruto = String(valor ?? "").trim();
  // Un número negativo es un error de tecleo, no un dato: se descarta en vez
  // de convertirlo en positivo (eso sería inventarse una cifra).
  if (bruto.startsWith("-")) return null;
  const n = Number.parseInt(bruto.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, max);
}

/**
 * Sanea el briefing que llega del navegador.
 * Devuelve { ok, errores, briefing }. Solo entran valores del catálogo.
 */
export function normalizarBriefing(entrada = {}) {
  const errores = [];

  const tipo = busca(TIPOS, entrada.tipo);
  if (!tipo) errores.push("Elige un tipo de inmueble de la lista.");

  const localizacion = limpiar(entrada.localizacion, 80);
  if (!localizacion) errores.push("Indica la localización del inmueble.");

  const cliente = busca(CLIENTES, entrada.cliente);
  if (!cliente) errores.push("Elige un cliente objetivo de la lista.");

  const objetivo = busca(OBJETIVOS, entrada.objetivo);
  if (!objetivo) errores.push("Elige el objetivo del vídeo.");

  const plataforma = busca(PLATAFORMAS, entrada.plataforma);
  if (!plataforma) errores.push("Elige la plataforma de destino.");

  const duracion = busca(DURACIONES, entrada.duracion);
  if (!duracion) errores.push("Elige la duración del vídeo.");

  const estilo = busca(ESTILOS, entrada.estilo);
  if (!estilo) errores.push("Elige un estilo creativo.");

  const generador = busca(GENERADORES, entrada.generador) || GENERADORES[0];

  const brutas = Array.isArray(entrada.caracteristicas) ? entrada.caracteristicas : [];
  const caracteristicas = [];
  for (const id of brutas.slice(0, 40)) {
    const c = busca(CARACTERISTICAS, id);
    if (c && !caracteristicas.includes(c)) caracteristicas.push(c);
  }

  if (errores.length) return { ok: false, errores, briefing: null };

  return {
    ok: true,
    errores: [],
    briefing: {
      referencia: limpiar(entrada.referencia, 40),
      tipo,
      localizacion,
      precio: limpiar(entrada.precio, 40),
      metros: entero(entrada.metros, 100000),
      habitaciones: entero(entrada.habitaciones, 60),
      banos: entero(entrada.banos, 40),
      caracteristicas,
      cliente,
      objetivo,
      plataforma,
      duracion,
      estilo,
      generador,
      variante: Math.max(0, Math.min(99, Number.parseInt(entrada.variante, 10) || 0)),
    },
  };
}

// ---------------------------------------------------------------------------
//  3. HONESTIDAD: qué sabemos y qué no
// ---------------------------------------------------------------------------

/** Frase con los datos REALES del inmueble. Nunca añade lo que no hay. */
export function fichaDelInmueble(b) {
  const partes = [`${b.tipo.nombre.toLowerCase()} en ${b.localizacion}`];
  if (b.metros) partes.push(`${b.metros} m²`);
  if (b.habitaciones) partes.push(`${b.habitaciones} ${b.habitaciones === 1 ? "habitación" : "habitaciones"}`);
  if (b.banos) partes.push(`${b.banos} ${b.banos === 1 ? "baño" : "baños"}`);
  if (b.precio) partes.push(b.precio);
  if (b.caracteristicas.length) partes.push(b.caracteristicas.map((c) => c.nombre.toLowerCase()).join(", "));
  return partes.join(" · ");
}

export function fichaDelInmuebleEn(b) {
  const partes = [`${b.tipo.en} in ${b.localizacion}`];
  if (b.metros) partes.push(`${b.metros} sqm`);
  if (b.habitaciones) partes.push(`${b.habitaciones} bedroom(s)`);
  if (b.banos) partes.push(`${b.banos} bathroom(s)`);
  if (b.caracteristicas.length) partes.push(b.caracteristicas.map((c) => c.en).join(", "));
  return partes.join(", ");
}

/** Avisos honestos: qué no se ha indicado y por tanto no aparecerá en el vídeo. */
export function notasDeHonestidad(b) {
  const faltan = [];
  if (!b.metros) faltan.push("superficie");
  if (!b.habitaciones) faltan.push("número de habitaciones");
  if (!b.banos) faltan.push("número de baños");
  if (!b.precio) faltan.push("precio");
  const notas = [];
  if (faltan.length) {
    notas.push(
      `No has indicado ${faltan.join(", ")}: la campaña no lo menciona en ningún sitio. Añádelo al briefing y vuelve a generar si quieres que aparezca.`
    );
  }
  if (!b.caracteristicas.length) {
    notas.push(
      "No has marcado características: el guion se mantiene en planos genéricos y honestos (luz, recorrido y entorno) sin prometer terraza, vistas ni piscina."
    );
  }
  notas.push(
    "Los textos en pantalla se añaden en edición (Premiere, CapCut o DaVinci): no se le piden al generador de vídeo porque los deforma."
  );
  notas.push(`Encuadre seguro de ${b.plataforma.nombre}: ${b.plataforma.seguridad}.`);
  return notas;
}

// ---------------------------------------------------------------------------
//  4. ESTUDIO CREATIVO LOCAL (modo sin IA)
// ---------------------------------------------------------------------------

// Rotación determinista según la variante: "Regenerar versión" cambia el
// resultado sin depender del azar (así los tests pueden comprobarlo).
const rota = (lista, variante, desplazamiento = 0) =>
  lista[(variante + desplazamiento) % lista.length];

const TITULOS = [
  (b) => `${b.tipo.nombre} en ${b.localizacion} — ${b.estilo.nombre}`,
  (b) => `${b.localizacion}: ${b.tipo.nombre.toLowerCase()} filmado como se merece`,
  (b) => `Una mirada a este ${b.tipo.nombre.toLowerCase()} de ${b.localizacion}`,
  (b) => `${b.tipo.nombre} en ${b.localizacion} · pieza ${b.plataforma.ratio}`,
];

const ESLOGANES = [
  () => "El espacio primero. Las palabras después.",
  (b) => `${b.localizacion}, visto con calma.`,
  () => "Hay casas que se enseñan. Y casas que se presentan.",
  () => "Lo importante no se cuenta: se ve.",
  (b) => `Un ${b.tipo.nombre.toLowerCase()} que no necesita adjetivos.`,
  () => "Entrar y saber que era este.",
];

/** Reparte los segundos entre las escenas de forma creíble. */
function repartirSegundos(total, numEscenas) {
  const base = Math.floor(total / numEscenas);
  const sobra = total - base * numEscenas;
  const duraciones = new Array(numEscenas).fill(base);
  // El sobrante va a las escenas centrales (las de contenido), no al cierre.
  for (let i = 0; i < sobra; i++) duraciones[Math.min(1 + i, numEscenas - 2)] += 1;
  const tramos = [];
  let t = 0;
  for (const d of duraciones) {
    tramos.push({ desde: t, hasta: t + d, dura: d });
    t += d;
  }
  return tramos;
}

const AEREOS = ["dron ascendente", "dron orbital lento", "plano cenital"];
const EXTERIORES = ["jardin", "piscina", "naturaleza", "centrico", "colegios", "hospitales"];

/**
 * Guion por escenas. Cada escena sale de un dato real del briefing:
 * apertura → contexto → una escena por característica marcada → cierre.
 */
export function guionDeEscenas(b) {
  const { estilo, tipo, plataforma, duracion, variante } = b;
  const n = duracion.escenas;
  const tramos = repartirSegundos(duracion.segundos, n);

  const beats = [];
  beats.push({
    etiqueta: "Apertura (hook)",
    accion: estilo.hook,
    exterior: tipo.exterior,
    texto: "Sin texto: que el primer plano trabaje solo.",
  });
  beats.push({
    etiqueta: "Contexto",
    accion: `${tipo.piezas[0]}, presentando dónde estamos: ${b.localizacion}.`,
    exterior: tipo.exterior,
    texto: b.referencia ? `Ref. ${b.referencia}` : b.localizacion,
  });
  for (const c of b.caracteristicas) {
    beats.push({
      etiqueta: c.nombre,
      accion: `${c.escena}.`,
      exterior: EXTERIORES.includes(c.id),
      texto: c.nombre,
    });
  }
  // Relleno honesto con el vocabulario propio del tipo de inmueble.
  for (let i = 1; i < tipo.piezas.length; i++) {
    beats.push({ etiqueta: "Recorrido", accion: `${tipo.piezas[i]}.`, exterior: false, texto: "" });
  }
  beats.push({
    etiqueta: "Emoción",
    accion: `Un plano sostenido que deja imaginar la vida aquí, pensado para ${b.cliente.nombre.toLowerCase()}: ${b.cliente.deseo}.`,
    exterior: false,
    texto: "",
  });

  const cierre = {
    etiqueta: "Cierre de marca",
    accion: "El espacio se queda quieto, la luz cae y entra el cierre de Asesoría Castresana.",
    exterior: tipo.exterior,
    texto: `${b.objetivo.cta} · ${MARCA.web}`,
  };
  const cuerpo = beats.slice(0, Math.max(1, n - 1));
  // Si el briefing es escueto, se rellena con detalles honestos (textura, luz,
  // silencio): nunca con estancias o elementos que nadie ha dicho que existan.
  const DETALLES = [
    "Detalle cercano: la textura de una superficie con la luz rozándola.",
    "Detalle: el marco de un hueco y lo que se ve a través.",
    "Detalle: una esquina de la estancia y el aire que la ocupa.",
    "Detalle: la sombra moviéndose despacio sobre el suelo.",
  ];
  let relleno = 0;
  while (cuerpo.length < n - 1) {
    cuerpo.push({
      etiqueta: "Detalle",
      accion: rota(DETALLES, variante, relleno++),
      exterior: false,
      texto: "",
    });
  }
  const secuencia = [...cuerpo, cierre];

  return secuencia.map((beat, i) => {
    let camara = rota(estilo.movimientos, variante, i);
    if (beat.exterior && i === 0 && tipo.exterior) camara = rota(AEREOS, variante, i);
    if (!beat.exterior && AEREOS.includes(camara)) {
      const terrestres = estilo.movimientos.filter((m) => !AEREOS.includes(m));
      camara = terrestres.length ? rota(terrestres, variante, i) : "gimbal interior fluido";
    }
    return {
      n: i + 1,
      desde: tramos[i].desde,
      hasta: tramos[i].hasta,
      dura: tramos[i].dura,
      etiqueta: beat.etiqueta,
      plano: beat.exterior
        ? i === 0 ? "Plano general" : "Plano medio exterior"
        : i === secuencia.length - 1 ? "Plano general interior" : "Plano medio / detalle",
      camara,
      luz: `${estilo.luz}. ${estilo.atmosfera}.`,
      accion: beat.accion,
      texto: beat.texto,
      ratio: plataforma.ratio,
    };
  });
}

/** Prompt maestro en español, adaptado al generador elegido. */
export function promptMaestroES(b, escenas) {
  const { estilo, plataforma, generador } = b;
  const lineas = [];
  lineas.push(
    `Vídeo inmobiliario profesional, realismo fotográfico, formato ${plataforma.ratio}, ${b.duracion.segundos} segundos. Sin texto en pantalla (se añade en edición).`
  );
  lineas.push(
    `Sujeto: ${fichaDelInmueble(b)}. No añadas ninguna estancia, material ni elemento que no esté en esta lista.`
  );
  lineas.push(
    `Estética: ${estilo.nombre.toLowerCase()} — ${estilo.paleta}. Luz: ${estilo.luz}. Atmósfera: ${estilo.atmosfera}. Óptica: ${estilo.lente}. Ritmo: ${estilo.ritmo}.`
  );
  lineas.push("");
  lineas.push("Secuencia:");
  for (const e of escenas) {
    lineas.push(`${e.n}. ${e.desde}-${e.hasta} s · ${e.plano} · ${e.camara} · ${e.accion}`);
  }
  lineas.push("");
  lineas.push(
    "Reglas: arquitectura creíble y coherente entre planos; sin personas reconocibles; sin logotipos; sin rótulos ni textos legibles; sin deformaciones de muebles ni de manos; misma hora del día y misma temperatura de color en todo el vídeo."
  );
  lineas.push(`Nota del motor (${generador.nombre}): ${generador.guia}`);
  return lineas.join("\n");
}

/** Master prompt en inglés, optimizado para los generadores de vídeo. */
export function promptMaestroEN(b, escenas) {
  const { estilo, plataforma } = b;
  const lineas = [];
  lineas.push(
    `Professional real estate video, photorealistic, ${plataforma.en}, ${b.duracion.segundos} seconds total. No on-screen text (added in post).`
  );
  lineas.push(
    `Subject: ${fichaDelInmuebleEn(b)}. Do not add any room, material or feature that is not in this list.`
  );
  lineas.push(
    `Look: ${estilo.en.look}. Lighting: ${estilo.en.luz}. Lens: ${estilo.en.lente}. Palette: graphite, champagne gold, warm white, stone grey.`
  );
  lineas.push("");
  lineas.push("Shot list:");
  for (const e of escenas) {
    lineas.push(`${e.n}. ${e.desde}-${e.hasta}s — ${MOVIMIENTOS_EN[e.camara] || e.camara} — ${e.etiqueta}.`);
  }
  lineas.push("");
  lineas.push(
    "Rules: believable, consistent architecture across shots; no recognizable people; no logos; no legible text or captions; no warped furniture or hands; same time of day and color temperature throughout."
  );
  return lineas.join("\n");
}

/** Campaña completa sin IA — el "modo estudio". */
export function componerCampana(b) {
  const escenas = guionDeEscenas(b);
  const v = b.variante;
  const titulo = rota(TITULOS, v)(b);
  const eslogan = rota(ESLOGANES, v, 1)(b);

  const concepto =
    `${b.estilo.hook} La pieza está construida para ${b.objetivo.foco}. ` +
    `Se dirige a ${b.cliente.nombre.toLowerCase()}: ${b.cliente.perfil} ` +
    `El vídeo no explica el inmueble, lo deja ver: ${escenas.length} planos en ${b.duracion.segundos} segundos, ` +
    `con ${b.estilo.luz} y un cierre de marca que pide una sola cosa.`;

  const vozEnOff = [
    `(${b.cliente.tono})`,
    `Hay un ${b.tipo.nombre.toLowerCase()} en ${b.localizacion} del que se habla poco.`,
    b.caracteristicas.length
      ? `${b.caracteristicas.map((c) => c.nombre.toLowerCase()).join(", ")}. Nada más, y nada menos.`
      : "No hace falta contarlo todo: basta con verlo con calma.",
    `${b.objetivo.cta}. Asesoría Castresana, gestión inmobiliaria en Oviedo.`,
  ].join(" ");

  const hashtags = [
    "#AsesoriaCastresana", "#InmoCastresana", "#Oviedo", "#Asturias",
    `#${b.tipo.nombre.replace(/\s+/g, "")}`, "#ViviendaAsturias", "#Inmobiliaria",
    "#VideoInmobiliario", "#AsturiasParaVivir", "#GestionInmobiliaria",
  ];
  if (b.caracteristicas.some((c) => c.id === "rentable")) hashtags.push("#InversionInmobiliaria");
  if (b.localizacion && !/oviedo/i.test(b.localizacion)) {
    const limpia = b.localizacion.replace(/[^\p{L}\p{N}]/gu, "");
    if (limpia) hashtags.push(`#${limpia}`);
  }

  const copyInstagram = [
    eslogan,
    "",
    `${fichaDelInmueble(b)}.`,
    "",
    `${b.objetivo.cta}. Escríbenos por aquí o llámanos al ${MARCA.telefonos[0]}.`,
    `${MARCA.nombre} · ${MARCA.web}`,
  ].join("\n");

  const copyTiktok = `${b.estilo.hook} ${b.tipo.nombre} en ${b.localizacion}. ${b.objetivo.cta} 👉 ${MARCA.web}`;

  const youtube = {
    titulo: `${b.tipo.nombre} en ${b.localizacion} | ${MARCA.nombre}`,
    descripcion: [
      `${fichaDelInmueble(b)}.`,
      "",
      `${b.objetivo.cta} · ${MARCA.web}`,
      `Teléfonos: ${MARCA.telefonos.join(" · ")}`,
      `${MARCA.nombre} — ${MARCA.ciudad}`,
    ].join("\n"),
  };

  const variantes = [
    {
      tipo: "Emocional",
      titulo: `${b.localizacion}, a la hora buena`,
      idea: `Misma secuencia, pero contada desde lo que de verdad busca (${b.cliente.deseo}): se abre con un detalle cotidiano y el inmueble aparece después, casi como consecuencia. Voz en off en primera persona y sin música hasta el segundo 5.`,
    },
    {
      tipo: "Cinematográfica",
      titulo: `Un ${b.tipo.nombre.toLowerCase()} en silencio`,
      idea: `Sin voz en off. Solo sonido ambiente y ${b.estilo.luz}. Planos más largos, dos o tres menos, y el cierre de marca sobre negro con el logotipo real puesto en edición.`,
    },
    {
      tipo: "Directa para conversión",
      titulo: `${b.objetivo.cta} — ${b.localizacion}`,
      idea: `Los datos por delante: ${fichaDelInmueble(b)}. Primer segundo con el dato más fuerte en pantalla (en edición), recorrido rápido de ${Math.max(3, escenas.length - 2)} planos y CTA repetido al principio y al final. Pensado para ${b.plataforma.nombre}.`,
    },
  ];

  return {
    motor: "estudio",
    titulo,
    concepto,
    eslogan,
    perfilComprador: `${b.cliente.nombre}. ${b.cliente.perfil} Lo que de verdad busca: ${b.cliente.deseo}. Tono con el que hay que hablarle: ${b.cliente.tono}.`,
    promptES: promptMaestroES(b, escenas),
    promptEN: promptMaestroEN(b, escenas),
    escenas,
    vozEnOff,
    copyInstagram,
    copyTiktok,
    youtube,
    hashtags,
    cta: `${b.objetivo.cta} · ${MARCA.nombre} · ${MARCA.web}`,
    negativePrompt: NEGATIVE_PROMPT,
    negativePromptEN: NEGATIVE_PROMPT_EN,
    variantes,
    notas: notasDeHonestidad(b),
  };
}

// ---------------------------------------------------------------------------
//  5. SERIALIZACIÓN — la campaña en texto (botón "Descargar campaña")
// ---------------------------------------------------------------------------

export function campanaATexto(c, b) {
  const L = [];
  L.push(`CASTRESANA LUXURY MOTION — ${c.titulo}`);
  L.push("=".repeat(70));
  L.push("");
  L.push(`Inmueble: ${fichaDelInmueble(b)}`);
  if (b.referencia) L.push(`Referencia: ${b.referencia}`);
  L.push(`Plataforma: ${b.plataforma.nombre} (${b.plataforma.ratio}) · Duración: ${b.duracion.segundos} s`);
  L.push(`Estilo: ${b.estilo.nombre} · Objetivo: ${b.objetivo.nombre} · Cliente: ${b.cliente.nombre}`);
  L.push(`Generador: ${b.generador.nombre} · Motor de la campaña: ${c.motor === "ia" ? "IA (Claude)" : "estudio local"}`);
  L.push("");
  L.push("1. CONCEPTO CREATIVO");
  L.push(c.concepto);
  L.push("");
  L.push("2. ESLOGAN");
  L.push(c.eslogan);
  L.push("");
  L.push("3. PERFIL DEL COMPRADOR IDEAL");
  L.push(c.perfilComprador);
  L.push("");
  L.push("4. PROMPT MAESTRO (ESPAÑOL)");
  L.push(c.promptES);
  L.push("");
  L.push("5. MASTER PROMPT (ENGLISH)");
  L.push(c.promptEN);
  L.push("");
  L.push("6. GUION POR ESCENAS");
  for (const e of c.escenas) {
    L.push(`  ${e.n}. ${e.desde}-${e.hasta} s · ${e.etiqueta}`);
    L.push(`     Plano: ${e.plano}`);
    L.push(`     Cámara: ${e.camara}`);
    L.push(`     Luz y atmósfera: ${e.luz}`);
    L.push(`     Acción visual: ${e.accion}`);
    L.push(`     Texto en edición: ${e.texto || "—"}`);
  }
  L.push("");
  L.push("7. VOZ EN OFF");
  L.push(c.vozEnOff);
  L.push("");
  L.push("8. COPY INSTAGRAM");
  L.push(c.copyInstagram);
  L.push("");
  L.push("9. COPY TIKTOK");
  L.push(c.copyTiktok);
  L.push("");
  L.push("10. YOUTUBE SHORTS");
  L.push(`Título: ${c.youtube.titulo}`);
  L.push(c.youtube.descripcion);
  L.push("");
  L.push("11. HASHTAGS");
  L.push(c.hashtags.join(" "));
  L.push("");
  L.push("12. CTA FINAL");
  L.push(c.cta);
  L.push("");
  L.push("13. NEGATIVE PROMPT");
  L.push(c.negativePrompt);
  if (c.negativePromptEN) {
    L.push("");
    L.push(`    (EN) ${c.negativePromptEN}`);
  }
  L.push("");
  L.push("14. VARIANTES ALTERNATIVAS");
  for (const v of c.variantes) {
    L.push(`  · ${v.tipo} — ${v.titulo}`);
    L.push(`    ${v.idea}`);
  }
  if (c.notas?.length) {
    L.push("");
    L.push("15. AVISOS DE HONESTIDAD");
    for (const n of c.notas) L.push(`  · ${n}`);
  }
  L.push("");
  L.push("-".repeat(70));
  for (const linea of MARCA.cierres) L.push(linea);
  L.push(`Teléfonos: ${MARCA.telefonos.join(" · ")}`);
  return L.join("\n");
}
