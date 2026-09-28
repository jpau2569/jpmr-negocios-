// ============================================================================
//  Fotos para Idealista — catálogos y funciones puras compartidas
// ----------------------------------------------------------------------------
//  Lo usan el navegador (app.js, interfaz.js) y el servidor
//  (api/_fotos-idealista.js). No depende de nada de Node ni del navegador.
//
//  Regla de oro, la misma de Chivato: **la IA identifica, el catálogo
//  explica**. El modelo solo devuelve identificadores de estos catálogos; el
//  nombre bonito de cada estancia, el consejo de qué retirar y el texto de
//  cada aviso salen de aquí. Cualquier identificador que no esté en la lista
//  se descarta en `normalizarRespuestaIA`.
//
//  `lib/fotos-idealista.js` reexporta este archivo: vive aquí para que el
//  navegador lo pueda cargar (lib/ no se usa desde las páginas).
// ============================================================================

/** Lado largo de la foto final que se sube a Idealista (sin ampliar nunca). */
export const LADO_SALIDA = 2560;
/** Lado largo de la copia pequeña que se manda a la IA. */
export const LADO_IA = 768;
/** Fotos por petición a la IA (y tope que acepta el servidor). */
export const MAX_FOTOS_IA = 20;
/** Tamaño máximo de una miniatura en base64 (caracteres). */
export const MAX_B64_FOTO = 600_000;
/** Tope de la petición entera: Vercel corta a 4,5 MB, dejamos margen. */
export const MAX_B64_PETICION = 3_600_000;
/** Distancia de Hamming (de 64) por debajo de la cual dos fotos se parecen. */
export const UMBRAL_PARECIDAS = 10;

// Estancias. `archivo` es el trozo que va en el nombre del archivo (sin tildes).
// `grupo` marca el orden recomendado para Idealista (menor = antes).
export const ESTANCIAS = [
  { id: "salon", nombre: "Salón", archivo: "salon", grupo: 1 },
  { id: "cocina", nombre: "Cocina", archivo: "cocina", grupo: 2 },
  { id: "dormitorio_principal", nombre: "Dormitorio principal", archivo: "dormitorio-principal", grupo: 3 },
  { id: "dormitorio", nombre: "Dormitorio", archivo: "dormitorio", grupo: 4 },
  { id: "bano", nombre: "Baño", archivo: "bano", grupo: 5 },
  { id: "aseo", nombre: "Aseo", archivo: "aseo", grupo: 6 },
  { id: "terraza", nombre: "Terraza", archivo: "terraza", grupo: 7 },
  { id: "balcon", nombre: "Balcón", archivo: "balcon", grupo: 8 },
  { id: "jardin", nombre: "Jardín", archivo: "jardin", grupo: 9 },
  { id: "bajo_cubierta", nombre: "Bajo cubierta", archivo: "bajo-cubierta", grupo: 10 },
  { id: "recibidor", nombre: "Recibidor", archivo: "recibidor", grupo: 11 },
  { id: "pasillo", nombre: "Pasillo", archivo: "pasillo", grupo: 12 },
  { id: "fachada", nombre: "Fachada", archivo: "fachada", grupo: 13 },
  { id: "garaje", nombre: "Garaje", archivo: "garaje", grupo: 14 },
  { id: "trastero", nombre: "Trastero", archivo: "trastero", grupo: 15 },
  { id: "otro", nombre: "Otra", archivo: "foto", grupo: 16 },
  // Al final del todo: lo que no es el piso en sí.
  { id: "vistas", nombre: "Vistas", archivo: "vistas", grupo: 20 },
  { id: "zona_comun", nombre: "Zona común", archivo: "zona-comun", grupo: 21 },
];

// Objetos que conviene retirar antes de repetir la foto.
export const OBJETOS = [
  { id: "movil", nombre: "móvil" },
  { id: "mandos", nombre: "mandos a distancia" },
  { id: "portarretratos", nombre: "fotos familiares y portarretratos" },
  { id: "productos_limpieza", nombre: "productos de limpieza" },
  { id: "cubo_fregona", nombre: "cubo y fregona" },
  { id: "botellas_alimentos", nombre: "botellas y comida a la vista" },
  { id: "ropa", nombre: "ropa" },
  { id: "calzado", nombre: "zapatos" },
  { id: "toallas_usadas", nombre: "toallas usadas" },
  { id: "papeleras", nombre: "papeleras y bolsas de basura" },
  { id: "cables", nombre: "cables sueltos" },
  { id: "electrodomestico_a_la_vista", nombre: "pequeños electrodomésticos fuera de sitio" },
  { id: "objetos_personales", nombre: "objetos personales" },
  { id: "desorden_encimera", nombre: "cosas sobre la encimera" },
  { id: "cama_deshecha", nombre: "cama sin hacer" },
];

// Avisos sobre la foto. `consejo` es lo que Pau puede hacer.
export const AVISOS = [
  { id: "foto_oscura", texto: "Foto oscura", consejo: "Sube persianas y enciende luces, o repítela de día." },
  { id: "torcida", texto: "Foto torcida", consejo: "Repítela con el móvil recto (las líneas verticales, verticales)." },
  { id: "poco_representativa", texto: "Enseña poco de la estancia", consejo: "Hazla desde una esquina, a la altura del pecho." },
  { id: "vistas_poco_atractivas", texto: "Las vistas no ayudan", consejo: "Mejor al final o fuera del anuncio." },
  { id: "posible_otro_inmueble", texto: "Puede ser de otro inmueble", consejo: "Comprueba que la foto es de este piso." },
  { id: "reflejo_fotografo", texto: "Se ve el reflejo de quien hace la foto", consejo: "Cambia el ángulo frente a espejos y cristales." },
];

const ID_ESTANCIAS = new Set(ESTANCIAS.map((e) => e.id));
const ID_OBJETOS = new Set(OBJETOS.map((o) => o.id));
const ID_AVISOS = new Set(AVISOS.map((a) => a.id));

export const estancia = (id) => ESTANCIAS.find((e) => e.id === id) || null;
export const objeto = (id) => OBJETOS.find((o) => o.id === id) || null;
export const aviso = (id) => AVISOS.find((a) => a.id === id) || null;

// ---------------------------------------------------------------------------
//  Herramienta que se le obliga a usar a Claude (salida JSON garantizada).
// ---------------------------------------------------------------------------
const nota = { type: "integer", minimum: 1, maximum: 5 };
export const HERRAMIENTA_FOTOS = {
  name: "clasificar_fotos",
  description: "Devuelve, para cada foto numerada, la estancia, la calidad, lo que conviene retirar y los avisos, usando solo los identificadores permitidos.",
  input_schema: {
    type: "object",
    properties: {
      fotos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            foto: { type: "integer", minimum: 1, description: "Número de la foto tal como aparece en su etiqueta «Foto N»." },
            estancia: { type: "string", enum: ESTANCIAS.map((e) => e.id) },
            calidad: {
              type: "object",
              properties: { luz: nota, encuadre: nota, nitidez: nota },
              required: ["luz", "encuadre", "nitidez"],
            },
            objetos_a_retirar: { type: "array", items: { type: "string", enum: OBJETOS.map((o) => o.id) } },
            avisos: { type: "array", items: { type: "string", enum: AVISOS.map((a) => a.id) } },
            es_portada_candidata: { type: "boolean" },
          },
          required: ["foto", "estancia", "calidad", "objetos_a_retirar", "avisos", "es_portada_candidata"],
        },
      },
    },
    required: ["fotos"],
  },
};

const nota15 = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
};

/**
 * Limpia lo que devuelve la IA. Solo pasan identificadores del catálogo; lo
 * demás se apunta en `ignorados` (para depurar, nunca se enseña como dato).
 * @param {object} entrada  input del tool_use ({ fotos: [...] })
 * @param {number} total    cuántas fotos se mandaron
 * @returns {{ fotos: (object|null)[], ignorados: string[] }}  fotos[i] es la i-ésima enviada
 */
export function normalizarRespuestaIA(entrada, total) {
  const n = Math.max(0, Math.min(100, Math.floor(Number(total) || 0)));
  const fotos = Array(n).fill(null);
  const ignorados = [];
  const lista = Array.isArray(entrada?.fotos) ? entrada.fotos : [];
  for (const f of lista) {
    const num = Math.floor(Number(f?.foto));
    if (!Number.isFinite(num) || num < 1 || num > n || fotos[num - 1]) continue;
    const est = String(f?.estancia || "");
    if (!ID_ESTANCIAS.has(est)) { if (est) ignorados.push(est.slice(0, 40)); }
    const filtra = (arr, validos) => {
      const vistos = new Set();
      for (const x of Array.isArray(arr) ? arr : []) {
        const id = String(x || "");
        if (validos.has(id)) vistos.add(id);
        else if (id) ignorados.push(id.slice(0, 40));
      }
      return [...vistos];
    };
    const c = f?.calidad && typeof f.calidad === "object" ? f.calidad : {};
    const calidad = { luz: nota15(c.luz), encuadre: nota15(c.encuadre), nitidez: nota15(c.nitidez) };
    calidad.media = Math.round(((calidad.luz + calidad.encuadre + calidad.nitidez) / 3) * 10) / 10;
    fotos[num - 1] = {
      estancia: ID_ESTANCIAS.has(est) ? est : "otro",
      calidad,
      objetos_a_retirar: filtra(f?.objetos_a_retirar, ID_OBJETOS),
      avisos: filtra(f?.avisos, ID_AVISOS),
      es_portada_candidata: f?.es_portada_candidata === true,
    };
  }
  return { fotos, ignorados: ignorados.slice(0, 20) };
}

// ---------------------------------------------------------------------------
//  Orden recomendado para Idealista (sin IA: solo con lo que ya se sabe)
// ---------------------------------------------------------------------------
const PREFERENCIA_PORTADA = { salon: 0.6, cocina: 0.4, fachada: 0.3 };

/** Nota global de una foto: la media de la IA si la hay, 3 si no. */
const notaDe = (f) => (Number.isFinite(f?.calidad?.media) ? f.calidad.media
  : Number.isFinite(f?.calidad) ? f.calidad : 3);

/**
 * Elige la portada: prefiere las candidatas de la IA y el salón, la cocina o
 * la fachada con buena luz. Nunca unas vistas o una zona común si hay otra.
 * @returns {string|null} id de la foto
 */
export function elegirPortada(fotos) {
  const activas = (fotos || []).filter((f) => f && !f.descartada);
  if (!activas.length) return null;
  const aptas = activas.filter((f) => (estancia(f.estancia)?.grupo ?? 16) < 20);
  const pool = aptas.length ? aptas : activas;
  let mejor = null, mejorNota = -Infinity;
  pool.forEach((f, i) => {
    const luz = Number.isFinite(f?.calidad?.luz) ? f.calidad.luz : 3;
    const pesa = notaDe(f) + (f.es_portada_candidata ? 1.5 : 0)
      + (PREFERENCIA_PORTADA[f.estancia] || 0) + luz * 0.2
      - (f.avisos?.length ? 0.8 : 0) - i * 1e-6;            // a igualdad, la primera
    if (pesa > mejorNota) { mejorNota = pesa; mejor = f; }
  });
  return mejor.id;
}

/**
 * Orden recomendado: portada, salón, cocina, dormitorio principal,
 * dormitorios, baños, terraza/balcón, resto y, al final, vistas y zona común.
 * Dentro de cada estancia, la de mejor nota primero (y si empatan, la que
 * Pau puso antes). Las descartadas (duplicados, quitadas) no entran.
 * @param {{id:string, estancia?:string, calidad?:object|number, es_portada_candidata?:boolean, descartada?:boolean}[]} fotos
 * @returns {string[]} ids en orden
 */
export function ordenarParaIdealista(fotos) {
  const activas = (fotos || []).filter((f) => f && !f.descartada);
  const portada = elegirPortada(activas);
  const resto = activas
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.id !== portada)
    .sort((a, b) => {
      const ga = estancia(a.f.estancia)?.grupo ?? 16;
      const gb = estancia(b.f.estancia)?.grupo ?? 16;
      if (ga !== gb) return ga - gb;
      const na = notaDe(a.f), nb = notaDe(b.f);
      if (na !== nb) return nb - na;
      return a.i - b.i;
    })
    .map(({ f }) => f.id);
  return portada ? [portada, ...resto] : resto;
}

// ---------------------------------------------------------------------------
//  Nombres de archivo: 01-salon.jpg, 02-dormitorio-principal.jpg,
//  03-dormitorio-2.jpg… El dormitorio principal cuenta como el primero, así
//  que el siguiente dormitorio ya es el 2.
// ---------------------------------------------------------------------------
/** Texto → trozo de nombre de archivo: sin tildes, minúsculas y guiones. */
export function sinTildes(texto, max = 40) {
  return String(texto || "")
    .replace(/[ºª]/g, "")                                   // «3ºB» → «3B»
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

/**
 * @param {(string|null)[]} estancias  id de estancia de cada foto, ya en orden
 * @returns {string[]} nombres (01-cocina.jpg…)
 */
export function nombresArchivo(estancias) {
  const lista = Array.isArray(estancias) ? estancias : [];
  const cifras = Math.max(2, String(lista.length).length);
  const hayPrincipal = lista.includes("dormitorio_principal");
  const cuenta = {};
  return lista.map((id, i) => {
    const e = estancia(id) || estancia("otro");
    cuenta[e.id] = (cuenta[e.id] || 0) + 1;
    let n = cuenta[e.id];
    if (e.id === "dormitorio" && hayPrincipal) n += 1;
    const numero = String(i + 1).padStart(cifras, "0");
    return `${numero}-${e.archivo}${n > 1 ? `-${n}` : ""}.jpg`;
  });
}

/** Nombre del ZIP: «<referencia>-fotos-idealista.zip» o «fotos-idealista.zip». */
export function nombreZip(referencia) {
  const ref = sinTildes(referencia, 40);
  return ref ? `${ref}-fotos-idealista.zip` : "fotos-idealista.zip";
}

// ---------------------------------------------------------------------------
//  Hash perceptual (dHash de 64 bits en 16 cifras hexadecimales)
// ---------------------------------------------------------------------------
/**
 * dHash a partir de 9×8 valores de gris (fila a fila): cada bit dice si un
 * píxel es más claro que su vecino de la derecha.
 * @param {ArrayLike<number>} gris  72 valores
 * @returns {string} 16 cifras hexadecimales
 */
export function dHashDesdeGris(gris) {
  if (!gris || gris.length !== 72) throw new Error("dHash necesita 9×8 = 72 valores de gris");
  let hex = "";
  for (let fila = 0; fila < 8; fila++) {
    let byte = 0;
    for (let col = 0; col < 8; col++) {
      const i = fila * 9 + col;
      byte = (byte << 1) | (gris[i] > gris[i + 1] ? 1 : 0);
    }
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Bits distintos entre dos dHash (0 = iguales, 64 = opuestos). */
export function hammingDHash(a, b) {
  const x = String(a || ""), y = String(b || "");
  if (!/^[0-9a-f]{16}$/i.test(x) || !/^[0-9a-f]{16}$/i.test(y)) return 64;
  let d = 0;
  for (let i = 0; i < 16; i += 4) {
    let v = parseInt(x.slice(i, i + 4), 16) ^ parseInt(y.slice(i, i + 4), 16);
    while (v) { d += v & 1; v >>>= 1; }
  }
  return d;
}
