// ============================================================================
//  Contador de gasto de Clara (API de Claude) y tope mensual
// ----------------------------------------------------------------------------
//  Suma el `usage` REAL que devuelve la API en cada llamada que paga Pau:
//  el chat (todas las rondas), el equipo (consultar_equipo), los tramos de
//  /api/clara-archivo y, de OpenRouter (segunda_opinion), las llamadas y los
//  tokens si vienen en la respuesta. Con eso calcula un coste ESTIMADO en
//  dólares con los precios oficiales de abajo.
//
//  Dónde se guarda:
//   · Con la nube (Supabase, la misma condición que la memoria): tabla
//     clara_uso, solo por funciones RPC (supabase/clara-uso.sql). Escribir
//     exige la clave de sincronización; leer el total del mes, no (son dos
//     cifras sin datos personales, para el chequeo de estado y el tope).
//   · Sin nube (o sin la tabla): el servidor devuelve el uso de cada respuesta
//     y clara.html lo acumula por mes en localStorage (por dispositivo).
//
//  Tope: CLARA_TOPE_MES_USD en Vercel. Sin ella no hay tope, solo contador.
//  Al 80 % se avisa; al 100 %, con la nube, se quitan las herramientas caras.
//
//  Funciones puras salvo las tres de la nube (leerUsoMes, leerUsoDetalle y
//  guardarUso), que usan la RPC de lib/memoria.js.
// ============================================================================

import { rpc } from "./memoria.js";

// ---------------------------------------------------------------------------
//  Precios oficiales (USD por millón de tokens). Fuente y fecha de consulta:
//  si cambia el modelo de Clara y no está aquí, el coste sale «sin verificar»
//  (nunca se inventa un precio).
// ---------------------------------------------------------------------------
export const FUENTE_PRECIOS = Object.freeze({
  url: "https://platform.claude.com/docs/en/about-claude/pricing",
  consultado: "2026-10-13",
  nota:
    "Precios en dólares (USD). Claude Sonnet 5: $2 / MTok de entrada y $10 / MTok de salida (el precio de lanzamiento pasó a ser el estándar; " +
    "ya no sube a $3/$15 el 1-9-2026), escritura de caché 5 min $2,50, escritura 1 h $4, lectura de caché $0,20. " +
    "Ejecución de código: 1.550 horas gratis al mes por organización y después $0,05 por hora y contenedor.",
});

export const PRECIOS_USD_MTOK = Object.freeze({
  "claude-sonnet-5": Object.freeze({ entrada: 2, escritura_5m: 2.5, escritura_1h: 4, lectura_cache: 0.2, salida: 10 }),
});

// Búsqueda web del servidor de Anthropic: $10 por 1.000 búsquedas (misma página).
// Clara no la usa (busca con Gemini), pero si apareciera en `usage` se cuenta.
export const PRECIO_BUSQUEDA_USD = 0.01;
// Horas de contenedor (ejecución de código): `usage` no trae las horas, solo
// el número de ejecuciones; con 1.550 h gratis al mes no se suman al coste.
export const HORAS_CODIGO_GRATIS_MES = 1550;

export const UMBRAL_AVISO = 0.8; // 80 % del tope
// Herramientas que se quitan al llegar al 100 % del tope (con la nube).
export const HERRAMIENTAS_CARAS = Object.freeze(["consultar_equipo", "preparar_archivo", "segunda_opinion"]);

// Campos del acumulado (los mismos que la tabla clara_uso).
export const CAMPOS_USO = Object.freeze([
  "entrada",
  "salida",
  "cache_lectura",
  "cache_escritura",
  "llamadas",
  "llamadas_openrouter",
  "tokens_openrouter",
  "ejecuciones_codigo",
  "llamadas_sin_precio",
]);

// Entero ≥ 0 (lo que no es número cuenta 0).
const n = (x) => {
  const v = Number(x);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
};

export function usoVacio() {
  const u = {};
  for (const c of CAMPOS_USO) u[c] = 0;
  u.coste_usd = 0;
  return u;
}

// Coste en dólares de UNA llamada. null si el modelo no tiene precio verificado.
export function costeLlamada(d, modelo) {
  const p = PRECIOS_USD_MTOK[modelo];
  if (!p) return null;
  const tokens =
    d.entrada * p.entrada +
    d.salida * p.salida +
    d.cache_lectura * p.lectura_cache +
    d.escritura_5m * p.escritura_5m +
    d.escritura_1h * p.escritura_1h;
  return tokens / 1e6 + d.busquedas * PRECIO_BUSQUEDA_USD;
}

// `usage` de la API de Claude → acumulado de una llamada.
export function usoDeRespuesta(usage, modelo) {
  const u = usoVacio();
  if (!usage || typeof usage !== "object") return u;
  const escritura = n(usage.cache_creation_input_tokens);
  const desglose = usage.cache_creation && typeof usage.cache_creation === "object" ? usage.cache_creation : null;
  let e5 = n(desglose?.ephemeral_5m_input_tokens);
  const e1 = n(desglose?.ephemeral_1h_input_tokens);
  // Sin desglose (o incompleto), lo que falta se cuenta como caché de 5 min, que es la que usa Clara.
  if (escritura > e5 + e1) e5 += escritura - e5 - e1;
  const servidor = usage.server_tool_use && typeof usage.server_tool_use === "object" ? usage.server_tool_use : {};
  const d = {
    entrada: n(usage.input_tokens),
    salida: n(usage.output_tokens),
    cache_lectura: n(usage.cache_read_input_tokens),
    escritura_5m: e5,
    escritura_1h: e1,
    busquedas: n(servidor.web_search_requests),
  };
  u.entrada = d.entrada;
  u.salida = d.salida;
  u.cache_lectura = d.cache_lectura;
  u.cache_escritura = e5 + e1;
  u.llamadas = 1;
  u.ejecuciones_codigo = n(servidor.code_execution_requests);
  const coste = costeLlamada(d, modelo);
  if (coste === null) u.llamadas_sin_precio = 1;
  else u.coste_usd = coste;
  return u;
}

// `usage` de OpenRouter (formato OpenAI: prompt_tokens, completion_tokens,
// total_tokens). Su coste NO se suma: se paga con el saldo de OpenRouter y no
// hemos verificado en qué viene su campo de coste.
export function usoDeOpenRouter(usage) {
  const u = usoVacio();
  u.llamadas_openrouter = 1;
  if (usage && typeof usage === "object") {
    u.tokens_openrouter = n(usage.total_tokens) || n(usage.prompt_tokens) + n(usage.completion_tokens);
  }
  return u;
}

export function sumaUso(a, b) {
  const r = usoVacio();
  for (const c of CAMPOS_USO) r[c] = n(a?.[c]) + n(b?.[c]);
  r.coste_usd = redondeaCoste((Number(a?.coste_usd) || 0) + (Number(b?.coste_usd) || 0));
  return r;
}

export const redondeaCoste = (x) => Math.round((Number(x) || 0) * 1e6) / 1e6;

export function hayUso(u) {
  return CAMPOS_USO.some((c) => n(u?.[c]) > 0);
}

// Acumulador de una petición (chat o tramo de archivo).
export function crearContador(modelo) {
  let total = usoVacio();
  return {
    claude(usage, m = modelo) {
      if (usage) total = sumaUso(total, usoDeRespuesta(usage, m));
    },
    openrouter(usage) {
      total = sumaUso(total, usoDeOpenRouter(usage));
    },
    get total() {
      return { ...total };
    },
  };
}

// ---------------------------------------------------------------------------
//  Mes y tope
// ---------------------------------------------------------------------------
// «2026-10» en hora de Madrid (el mes de Pau, no el de los servidores).
export function mesActual(fecha = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit" }).formatToParts(fecha);
    const ano = partes.find((p) => p.type === "year")?.value;
    const mes = partes.find((p) => p.type === "month")?.value;
    if (ano && mes) return `${ano}-${mes}`;
  } catch {
    /* sin Intl: se usa UTC */
  }
  return fecha.toISOString().slice(0, 7);
}

export const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

// Tope mensual en dólares (CLARA_TOPE_MES_USD). null = sin tope.
export function topeMensual(env = process.env) {
  const bruto = String(env?.CLARA_TOPE_MES_USD ?? "").trim().replace(",", ".");
  if (!bruto) return null;
  const t = Number(bruto);
  return Number.isFinite(t) && t > 0 ? t : null;
}

// { nivel: "sin_tope" | "sin_datos" | "ok" | "aviso" | "agotado", porcentaje }
export function nivelTope(gastado, tope) {
  if (!tope) return { nivel: "sin_tope", porcentaje: null };
  const g = Number(gastado);
  if (!Number.isFinite(g) || g < 0) return { nivel: "sin_datos", porcentaje: null };
  const p = g / tope;
  return { nivel: p >= 1 ? "agotado" : p >= UMBRAL_AVISO ? "aviso" : "ok", porcentaje: Math.round(p * 100) };
}

// Bloque de sistema para Clara cuando se ha llegado al tope (con la nube).
export function textoTopeAlcanzado(gastado, tope) {
  return (
    `## Tope de gasto alcanzado\n` +
    `Este mes se han gastado unos ${formatoUsd(gastado)} $ (estimado) de un tope de ${formatoUsd(tope)} $ (CLARA_TOPE_MES_USD). ` +
    `Por eso ahora NO tienes consultar_equipo, preparar_archivo ni segunda_opinion. ` +
    `Díselo a Pau en una línea al empezar tu respuesta y sigue con el chat normal; si hace falta un archivo, usa la opción rápida (bloque csv o HTML). ` +
    `Para recuperarlas: subir el tope en Vercel o esperar al mes que viene.`
  );
}

export function formatoUsd(x) {
  const v = Number(x) || 0;
  const dec = v > 0 && v < 0.1 ? 4 : 2;
  return v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: dec });
}

// Lo que se manda a la RPC: solo los campos conocidos, enteros y acotados.
export function usoParaGuardar(u) {
  const r = {};
  for (const c of CAMPOS_USO) r[c] = Math.min(n(u?.[c]), 50_000_000);
  r.coste_usd = Math.min(Math.max(redondeaCoste(u?.coste_usd), 0), 50); // ninguna respuesta cuesta tanto: es un tope de seguridad
  return r;
}

// Lo que se enseña en el chequeo de estado (sin claves ni datos personales).
export function estadoUso(env = process.env) {
  const tope = topeMensual(env);
  const nube = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
  return {
    mes: mesActual(),
    tope_usd: tope,
    aviso_al: `${Math.round(UMBRAL_AVISO * 100)} %`,
    almacen: nube
      ? "nube (tabla clara_uso de Supabase; si aún no existe, cada dispositivo cuenta lo suyo)"
      : "local (cada dispositivo cuenta lo suyo en su navegador)",
    al_100: tope
      ? nube
        ? "se quitan consultar_equipo, preparar_archivo y segunda_opinion, y /api/clara-archivo responde 402"
        : "sin nube el tope solo avisa (es por dispositivo)"
      : "sin tope (falta CLARA_TOPE_MES_USD): solo contador",
    precios_usd_mtok: PRECIOS_USD_MTOK,
    fuente_precios: FUENTE_PRECIOS,
  };
}

// ---------------------------------------------------------------------------
//  Nube (Supabase): funciones de supabase/clara-uso.sql
// ---------------------------------------------------------------------------
const TIEMPO_NUBE_MS = 4000; // el contador nunca puede comerse el minuto de Vercel

// Total del mes { coste_usd, llamadas } o null si no se puede leer (sin tabla, caída…).
export async function leerUsoMes(mes = mesActual()) {
  try {
    const r = await rpc("clara_uso_resumen", { mes_uso: mes }, { tiempo: TIEMPO_NUBE_MS });
    if (!r || typeof r !== "object") return null;
    return { mes, coste_usd: redondeaCoste(r.coste_usd), llamadas: n(r.llamadas) };
  } catch (e) {
    console.warn("[uso] no se pudo leer el total del mes:", String(e?.message || e).slice(0, 200));
    return null;
  }
}

// Detalle del mes (todos los campos), con la clave de sincronización.
export async function leerUsoDetalle(clave, mes = mesActual()) {
  const r = await rpc("clara_uso_lee", { clave, mes_uso: mes }, { tiempo: TIEMPO_NUBE_MS });
  return r && typeof r === "object" ? { ...usoVacio(), ...r, mes } : { ...usoVacio(), mes };
}

// Suma el uso al mes en la nube y devuelve la fila actualizada. Lanza si falla.
export async function guardarUso(clave, uso, mes = mesActual()) {
  const r = await rpc("clara_uso_suma", { clave, mes_uso: mes, uso: usoParaGuardar(uso) }, { tiempo: TIEMPO_NUBE_MS });
  if (!r || typeof r !== "object") throw new Error("respuesta vacía de clara_uso_suma");
  return { ...usoVacio(), ...r, mes };
}

// ---------------------------------------------------------------------------
//  Cierre de una petición: guarda el uso en la nube si se puede y devuelve lo
//  que viaja al navegador.
//    { uso, uso_estado: { mes, almacen, guardado, total, tope_usd, nivel, porcentaje, motivo? } }
//  · guardado = true  → el total del mes es el de la nube (todos los dispositivos).
//  · guardado = false → clara.html suma `uso` a su contador local del mes.
// ---------------------------------------------------------------------------
export async function registrarUso(total, { clave = "", nube = false, tope = topeMensual(), mes = mesActual(), guardar = guardarUso } = {}) {
  const uso = { ...usoVacio(), ...total };
  const estado = { mes, almacen: "local", guardado: false, total: null, tope_usd: tope, nivel: tope ? "sin_datos" : "sin_tope", porcentaje: null };
  if (nube && clave && hayUso(uso)) {
    try {
      const fila = await guardar(clave, uso, mes);
      estado.almacen = "nube";
      estado.guardado = true;
      estado.total = { coste_usd: redondeaCoste(fila.coste_usd), llamadas: n(fila.llamadas), llamadas_sin_precio: n(fila.llamadas_sin_precio) };
      Object.assign(estado, nivelTope(estado.total.coste_usd, tope));
    } catch (e) {
      estado.motivo = motivoFalloNube(e);
    }
  } else if (nube && !clave) {
    estado.motivo = "sin clave de sincronización en este dispositivo";
  }
  return { uso, uso_estado: estado };
}

// Motivo legible de un fallo de la nube del contador.
export function motivoFalloNube(e) {
  const m = String(e?.message || e);
  if (m.includes("incorrecta")) return "clave de sincronización incorrecta";
  if (/404|PGRST20/.test(m)) return "falta la tabla clara_uso en Supabase (pega supabase/clara-uso.sql en el SQL Editor)";
  return "la nube no respondió a tiempo";
}
