// ============================================================================
//  Cruzar pisos y clientes (herramienta cruzar_clientes)
// ----------------------------------------------------------------------------
//  Cruza la cartera publicada en www.asesoriacastresana.com (lib/cartera.js)
//  con los clientes que buscan. Fuentes, en este orden y solo las que existan:
//   1. Clientes de Oportunidades Únicas (tabla ou_clientes de Supabase, ver
//      oportunidades/esquema.sql): operación, presupuesto, zonas, habitaciones,
//      metros y lo que necesitan.
//   2. Hot-leads de CasteBot (tabla castebot_leads, RPC castebot_leads_lista,
//      que exige la clave de sincronización): texto libre «Nombre / Qué
//      quiere / Dato clave», del que se sacan los criterios con el mismo
//      extractor de la alta rápida (lib/oportunidades-extras.js).
//
//  El cálculo es el de Oportunidades (coincidencia() de lib/oportunidades.js),
//  que acota el exceso sobre presupuesto y ESCRIBE LOS MOTIVOS. Aquí solo se
//  adapta a la cartera web: lo que el listado no dice (garaje, terraza…) va
//  como «sin comprobar», nunca como «no tiene».
//
//  Solo lectura. Datos personales al mínimo: al modelo le llegan el nombre de
//  pila (o alias), lo que busca y el presupuesto; el teléfono, solo si Pau lo
//  pide. La clave de servicio (SUPABASE_SERVICE_KEY) solo se usa aquí, en el
//  servidor, y solo con la clave de sincronización ya validada.
// ============================================================================

import { coincidencia, CARACTERISTICAS } from "./oportunidades.js";
import { extraerFicha, CIUDADES_ASTURIAS } from "./oportunidades-extras.js";

export const MAX_RESULTADOS = 8;
const MAX_CLIENTES = 300;
const TIEMPO_SUPABASE_MS = 8000;

const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const euros = (n) => `${Math.round(n).toLocaleString("es-ES")} €`;

// Nombre de pila (o alias): la primera palabra, sin apellidos.
export function alias(nombre) {
  const p = String(nombre || "").trim().split(/\s+/)[0] || "";
  return p.slice(0, 30) || "Cliente sin nombre";
}

// ---------------------------------------------------------------------------
//  Adaptadores (puros)
// ---------------------------------------------------------------------------
// Piso del listado de la web → la forma que espera coincidencia().
export function inmuebleDeCartera(it) {
  const t = sinTildes(`${it?.localidad || ""} ${it?.titulo || ""}`);
  const ciudad = it?.localidad || [...CIUDADES_ASTURIAS].sort((a, b) => b.length - a.length).find((c) => new RegExp(`\\b${sinTildes(c)}\\b`).test(t)) || null;
  return {
    referencia: it?.ref || null,
    titulo: it?.titulo || null,
    url: it?.url || null,
    operacion: it?.operacion === "alquiler" ? "alquiler" : "venta",
    precio: Number(it?.precio) > 0 ? Number(it.precio) : null,
    ciudad,
    // Sin localidad reconocida, el título hace de zona para comparar (p. ej. «Piso en El Llano»).
    zona: ciudad ? null : it?.titulo || null,
    habitaciones: Number(it?.habitaciones) > 0 ? Number(it.habitaciones) : null,
    metros: Number(it?.m2) > 0 ? Number(it.m2) : null,
    caracteristicas: null, // el listado no las da: «sin comprobar»
  };
}

// Fila de ou_clientes → cliente para el cruce.
export function clienteDeOportunidades(c, conTelefono = false) {
  const r = {
    fuente: "Oportunidades Únicas",
    alias: alias(c?.nombre),
    operacion: c?.operacion === "alquiler" ? "alquiler" : c?.operacion === "venta" ? "venta" : null,
    presupuesto_max: Number(c?.presupuesto_max) > 0 ? Number(c.presupuesto_max) : null,
    zonas: Array.isArray(c?.zonas) ? c.zonas.filter(Boolean).map(String).slice(0, 10) : [],
    habitaciones_min: Number(c?.habitaciones_min) > 0 ? Number(c.habitaciones_min) : null,
    metros_min: Number(c?.metros_min) > 0 ? Number(c.metros_min) : null,
    necesita: Array.isArray(c?.necesita) ? c.necesita.filter((n) => CARACTERISTICAS.some((x) => x.id === n)) : [],
  };
  if (conTelefono && c?.telefono) r.telefono = String(c.telefono).slice(0, 30);
  return r;
}

// Línea «Etiqueta: valor» de un hot-lead de CasteBot.
const campo = (texto, re) => String(texto || "").split(/\r?\n/).map((l) => l.match(re)).find(Boolean)?.[1]?.trim() || "";

// Hot-lead de CasteBot (texto libre) → cliente para el cruce, o null si no busca piso.
export function clienteDeLead(l, conTelefono = false) {
  const resumen = String(l?.resumen || "");
  const nombre = campo(resumen, /^\s*Nombre\s*:\s*(.+)$/i);
  const quiere = [campo(resumen, /^\s*Qu[eé] quiere\s*:\s*(.+)$/i), campo(resumen, /^\s*Dato clave\s*:\s*(.+)$/i)].filter(Boolean).join(". ");
  if (!quiere) return null;
  const t = sinTildes(quiere);
  // Propietarios que quieren vender o tasar: no buscan piso.
  if (/\b(vender|tasar|valorar)\b/.test(t) && !/\b(compr|alquil)/.test(t)) return null;
  const f = extraerFicha(quiere);
  const operacion = /alquil|arrend|inquilin/.test(t) ? "alquiler" : /compr|adquir|invert|inversion/.test(t) ? "venta" : null;
  const r = {
    fuente: `CasteBot (${String(l?.agente || "agente").slice(0, 20)})`,
    alias: nombre ? alias(nombre) : "Lead sin nombre",
    operacion,
    presupuesto_max: Number(f.precio) > 0 ? Number(f.precio) : null,
    zonas: [f.ciudad, f.zona].filter(Boolean),
    habitaciones_min: Number(f.habitaciones) > 0 ? Number(f.habitaciones) : null,
    metros_min: Number(f.metros) > 0 ? Number(f.metros) : null,
    necesita: Array.isArray(f.caracteristicas) ? f.caracteristicas : [],
    busca: quiere.slice(0, 200),
    texto_libre: true,
  };
  if (conTelefono) {
    const tel = campo(resumen, /^\s*Tel[eé]fono[^:]*:\s*(.+)$/i);
    if (tel) r.telefono = tel.slice(0, 40);
  }
  return r;
}

// ---------------------------------------------------------------------------
//  Encaje de un cliente con un piso (puro). Reutiliza coincidencia() y solo
//  corrige lo que la cartera web no sabe, sin inventar.
// ---------------------------------------------------------------------------
const nombreCaract = (id) => (CARACTERISTICAS.find((c) => c.id === id) || { nombre: id }).nombre.toLowerCase();

export function encaje(cliente, inmueble) {
  const sinCaracteristicas = !Array.isArray(inmueble.caracteristicas);
  const operacionDesconocida = !cliente.operacion;
  const c = {
    ...cliente,
    operacion: operacionDesconocida ? inmueble.operacion : cliente.operacion,
    necesita: sinCaracteristicas ? [] : cliente.necesita,
  };
  const r = coincidencia(c, { ...inmueble, caracteristicas: inmueble.caracteristicas || [] });
  let puntos = r.puntos;
  const motivos = [...r.motivos];
  const peros = [...r.peros];
  const sinComprobar = [];
  if (operacionDesconocida) {
    // No se regalan los 35 puntos de la operación si no consta qué busca.
    puntos -= 35;
    const i = motivos.findIndex((m) => /^busca (comprar|alquilar)$/.test(m));
    if (i >= 0) motivos.splice(i, 1);
    sinComprobar.push("si compra o alquila");
  }
  if (sinCaracteristicas && cliente.necesita?.length) {
    sinComprobar.push(cliente.necesita.map(nombreCaract).join(", "));
  }
  if (cliente.metros_min) {
    if (inmueble.metros) {
      if (inmueble.metros >= cliente.metros_min) motivos.push(`${inmueble.metros} m² (pide ${cliente.metros_min})`);
      else peros.push(`tiene ${inmueble.metros} m² y pide ${cliente.metros_min}`);
    } else sinComprobar.push("los metros");
  }
  return { puntos: Math.max(0, Math.min(100, puntos)), motivos, peros, sinComprobar };
}

// ¿Qué clientes encajan con el piso? De mejor a peor, solo los que puntúan.
export function cruzarPorPiso(inmueble, clientes, limite = MAX_RESULTADOS) {
  return (clientes || [])
    .map((cliente) => ({ cliente, ...encaje(cliente, inmueble) }))
    .filter((m) => m.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, limite);
}

// ¿Qué pisos le encajan al cliente?
export function cruzarPorCliente(cliente, inmuebles, limite = MAX_RESULTADOS) {
  return (inmuebles || [])
    .map((inmueble) => ({ inmueble, ...encaje(cliente, inmueble) }))
    .filter((m) => m.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, limite);
}

// Clientes cuyo alias coincide con el nombre que da Pau (sin tildes ni mayúsculas).
export function buscarClientes(clientes, nombre) {
  const q = sinTildes(nombre).trim();
  if (!q) return [];
  const exactos = (clientes || []).filter((c) => sinTildes(c.alias) === q);
  return exactos.length ? exactos : (clientes || []).filter((c) => sinTildes(c.alias).includes(q) || q.includes(sinTildes(c.alias)));
}

// ---------------------------------------------------------------------------
//  Textos para Clara (puros)
// ---------------------------------------------------------------------------
export function lineaCliente(c) {
  const busca = [
    c.operacion ? (c.operacion === "alquiler" ? "alquilar" : "comprar") : null,
    c.presupuesto_max ? `hasta ${euros(c.presupuesto_max)}` : "sin presupuesto anotado",
    c.zonas?.length ? `en ${c.zonas.join(" / ")}` : null,
    c.habitaciones_min ? `${c.habitaciones_min}+ hab.` : null,
    c.metros_min ? `${c.metros_min}+ m²` : null,
    c.necesita?.length ? `con ${c.necesita.map(nombreCaract).join(", ")}` : null,
  ].filter(Boolean);
  const extra = c.texto_libre ? ` (leído de su mensaje: «${c.busca}»)` : "";
  return `${c.alias} · ${c.fuente} · busca: ${busca.join(", ")}${extra}${c.telefono ? ` · tel. ${c.telefono}` : ""}`;
}

export function lineaPiso(p) {
  return `ref ${p.referencia || "sin referencia"} · ${p.titulo || "sin título"} · ${p.precio ? euros(p.precio) + (p.operacion === "alquiler" ? "/mes" : "") : "precio a consultar"}${p.metros ? ` · ${p.metros} m²` : ""}${p.habitaciones ? ` · ${p.habitaciones} hab.` : ""} · ${p.url || ""}`.trim();
}

function lineaEncaje(m) {
  return [
    `${m.puntos}/100`,
    m.motivos.length ? `encaja: ${m.motivos.join(", ")}` : null,
    m.peros.length ? `no encaja: ${m.peros.join(", ")}` : null,
    m.sinComprobar.length ? `sin comprobar: ${m.sinComprobar.join("; ")}` : null,
  ].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
//  Fuentes (con red; inyectables en las pruebas)
// ---------------------------------------------------------------------------
// Clientes de Oportunidades Únicas con la clave de servicio. { ok, clientes } o { ok:false, motivo }.
export async function leerClientesOportunidades({ conTelefono = false, env = process.env, fetcher = fetch } = {}) {
  if (!env.SUPABASE_URL) return { ok: false, motivo: "falta SUPABASE_URL en Vercel" };
  if (!env.SUPABASE_SERVICE_KEY) {
    return { ok: false, motivo: "falta SUPABASE_SERVICE_KEY en Vercel (la clave service_role de Supabase, la misma de Oportunidades Únicas)" };
  }
  const columnas = ["nombre", "tipo", "operacion", "presupuesto_max", "zonas", "habitaciones_min", "metros_min", "necesita"];
  if (conTelefono) columnas.push("telefono");
  const consulta =
    `select=${columnas.join(",")}&anonimizado=eq.false&tipo=in.(comprador,inversor,inquilino)` + `&order=actualizado.desc&limit=${MAX_CLIENTES}`;
  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), TIEMPO_SUPABASE_MS);
  try {
    const r = await fetcher(`${env.SUPABASE_URL}/rest/v1/ou_clientes?${consulta}`, {
      method: "GET",
      signal: ctrl.signal,
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, Accept: "application/json" },
    });
    const cuerpo = await r.text();
    if (!r.ok) {
      if (r.status === 404 || /42P01|PGRST20/.test(cuerpo)) {
        return { ok: false, motivo: "no existe la tabla ou_clientes (pega oportunidades/esquema.sql en el SQL Editor de Supabase)" };
      }
      if (r.status === 401 || r.status === 403) return { ok: false, motivo: "Supabase rechazó SUPABASE_SERVICE_KEY (revísala en Vercel)" };
      return { ok: false, motivo: `Supabase respondió ${r.status}` };
    }
    const filas = JSON.parse(cuerpo || "[]");
    return { ok: true, clientes: (Array.isArray(filas) ? filas : []).map((c) => clienteDeOportunidades(c, conTelefono)) };
  } catch (e) {
    return { ok: false, motivo: e?.name === "AbortError" ? "Supabase tardó demasiado" : `no se pudo conectar con Supabase (${String(e?.message || e).slice(0, 80)})` };
  } finally {
    clearTimeout(alarma);
  }
}

// Hot-leads de CasteBot con la clave de sincronización. { ok, clientes, descartados } o { ok:false, motivo }.
export async function leerLeadsCastebot(clave, rpc, { conTelefono = false } = {}) {
  try {
    const lista = await rpc("castebot_leads_lista", { clave });
    const leads = Array.isArray(lista) ? lista : [];
    const clientes = leads.map((l) => clienteDeLead(l, conTelefono)).filter(Boolean);
    return { ok: true, clientes, descartados: leads.length - clientes.length };
  } catch (e) {
    const m = String(e?.message || e);
    if (m.includes("incorrecta")) return { ok: false, motivo: "clave de sincronización incorrecta" };
    if (/404|PGRST20/.test(m)) return { ok: false, motivo: "no existe la función castebot_leads_lista en Supabase (es la del panel de hot-leads)" };
    return { ok: false, motivo: `no se pudieron leer (${m.slice(0, 80)})` };
  }
}

// ---------------------------------------------------------------------------
//  La herramienta entera
//  deps: { claveSync, nube (bool: clave validada), obtenerCartera, rpc,
//          leerClientes (opcional, para pruebas) }
// ---------------------------------------------------------------------------
export async function cruzarClientes(input, deps = {}) {
  const { claveSync, nube, obtenerCartera, rpc } = deps;
  if (!nube || !claveSync) {
    return (
      "Para cruzar pisos y clientes hace falta la nube activa: SUPABASE_URL y SUPABASE_ANON_KEY en Vercel y la clave de sincronización escrita en 🧠 Memoria. " +
      "Para los clientes de Oportunidades Únicas, además SUPABASE_SERVICE_KEY y el esquema oportunidades/esquema.sql. Díselo a Pau con ese paso."
    );
  }
  const modo = input?.modo === "cliente" ? "cliente" : input?.modo === "piso" ? "piso" : null;
  if (!modo) return "Indica el modo: «piso» (qué clientes encajan con un piso, con su referencia) o «cliente» (qué pisos le encajan a un cliente, con su nombre).";
  const conTelefono = input?.incluir_telefono === true;
  const leerClientes = deps.leerClientes || ((o) => leerClientesOportunidades(o));

  // Clientes de las dos fuentes y cartera, en paralelo.
  const [ou, cb, cartera] = await Promise.all([
    leerClientes({ conTelefono }),
    leerLeadsCastebot(claveSync, rpc, { conTelefono }),
    obtenerCartera().catch((e) => ({ items: [], errores: [String(e?.message || e)] })),
  ]);
  const clientes = [...(ou.ok ? ou.clientes : []), ...(cb.ok ? cb.clientes : [])];
  const pisos = (cartera?.items || []).map(inmuebleDeCartera);
  const fuentes = [
    `Oportunidades Únicas: ${ou.ok ? `${ou.clientes.length} cliente(s) que buscan` : `no disponible — ${ou.motivo}`}`,
    `CasteBot: ${cb.ok ? `${cb.clientes.length} hot-lead(s) que buscan${cb.descartados ? ` (${cb.descartados} sin búsqueda clara o de propietarios, fuera)` : ""}` : `no disponible — ${cb.motivo}`}`,
    `Cartera web: ${pisos.length} piso(s)${cartera?.errores?.length ? ` (avisos: ${cartera.errores.join("; ")})` : ""}`,
  ];
  const cabecera = `Fuentes leídas ahora:\n- ${fuentes.join("\n- ")}`;
  const pie =
    "\n\nNotas: la puntuación (0-100) es la de Oportunidades Únicas y cada punto lleva su motivo; «sin comprobar» es lo que la cartera web no publica en el listado (ábrelo con ficha_inmueble si importa). " +
    "Los criterios de CasteBot salen de texto libre: confírmalos con el cliente. No inventes nada que no esté aquí." +
    (conTelefono ? "" : " Por discreción no van teléfonos: si Pau los quiere, vuelve a llamar con incluir_telefono.");

  if (!clientes.length) {
    return `${cabecera}\n\nNo hay clientes que buscan con los que cruzar. Para tenerlos: dar de alta clientes en Oportunidades Únicas (con SUPABASE_SERVICE_KEY en Vercel) o esperar a los hot-leads de CasteBot.`;
  }

  if (modo === "piso") {
    const q = String(input?.referencia || "").trim();
    if (!q) return "Dime la referencia del piso (la que sale en mi_cartera) para buscarle clientes.";
    const qn = sinTildes(q).replace(/[^a-z0-9]/g, "");
    const piso = pisos.find((p) => sinTildes(p.referencia).replace(/[^a-z0-9]/g, "") === qn || String(p.url || "").includes(`-es${q.replace(/^es/i, "")}.html`));
    if (!piso) {
      return `${cabecera}\n\nNo encuentro la referencia «${q.slice(0, 40)}» en la cartera publicada. Referencias publicadas: ${pisos.map((p) => p.referencia).filter(Boolean).slice(0, 60).join(", ") || "ninguna leída"}.`;
    }
    const lista = cruzarPorPiso(piso, clientes);
    const cuerpo = lista.length
      ? lista.map((m, i) => `${i + 1}. ${lineaCliente(m.cliente)}\n   ${lineaEncaje(m)}`).join("\n")
      : "Ningún cliente encaja con este piso (todos puntúan 0).";
    return `${cabecera}\n\nPiso: ${lineaPiso(piso)}\n\nClientes que encajan (de mejor a peor, máximo ${MAX_RESULTADOS}):\n${cuerpo}${pie}`;
  }

  const nombre = String(input?.cliente || "").trim().slice(0, 60);
  if (!nombre) return "Dime el nombre del cliente para buscarle pisos.";
  const encontrados = buscarClientes(clientes, nombre);
  if (!encontrados.length) {
    return `${cabecera}\n\nNo encuentro a «${nombre}» entre los clientes que buscan. Clientes disponibles: ${clientes.map((c) => c.alias).slice(0, 40).join(", ")}.`;
  }
  if (encontrados.length > 3) {
    return `${cabecera}\n\nHay ${encontrados.length} clientes que se llaman parecido a «${nombre}»: ${encontrados.map(lineaCliente).slice(0, 10).join(" | ")}. Pregúntale a Pau cuál es (por la fuente o lo que busca).`;
  }
  const bloques = encontrados.map((c) => {
    const lista = cruzarPorCliente(c, pisos);
    const cuerpo = lista.length
      ? lista.map((m, i) => `${i + 1}. ${lineaPiso(m.inmueble)}\n   ${lineaEncaje(m)}`).join("\n")
      : "Ningún piso de la cartera le encaja (todos puntúan 0).";
    return `Cliente: ${lineaCliente(c)}\nPisos que le encajan (de mejor a peor, máximo ${MAX_RESULTADOS}):\n${cuerpo}`;
  });
  return `${cabecera}\n\n${bloques.join("\n\n")}${pie}`;
}

// Esquema que ve Clara (solo con la nube activa).
export const HERRAMIENTA_CRUZAR = {
  name: "cruzar_clientes",
  description:
    "Cruza la cartera publicada con los clientes que buscan (clientes de Oportunidades Únicas y hot-leads de CasteBot). Modo «piso»: qué clientes encajan con un piso (pasa su referencia). Modo «cliente»: qué pisos le encajan a un cliente (pasa su nombre). Devuelve una puntuación de 0 a 100 con los motivos escritos, lo que no encaja y lo que está sin comprobar. Solo lectura. Sin teléfonos salvo que Pau los pida.",
  input_schema: {
    type: "object",
    properties: {
      modo: { type: "string", enum: ["piso", "cliente"], description: "piso: clientes para un piso. cliente: pisos para un cliente." },
      referencia: { type: "string", description: "Modo piso: referencia del piso tal como sale en mi_cartera." },
      cliente: { type: "string", description: "Modo cliente: nombre del cliente." },
      incluir_telefono: { type: "boolean", description: "Solo si Pau pide los teléfonos expresamente." },
    },
    required: ["modo"],
  },
};
