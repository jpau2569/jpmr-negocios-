// ============================================================================
//  Cruzar pisos y clientes (herramienta cruzar_clientes)
// ----------------------------------------------------------------------------
//  Cruza la cartera publicada en www.asesoriacastresana.com (lib/cartera.js)
//  con los clientes que buscan. Fuentes, en este orden y solo las que existan:
//   1. Clientes de Oportunidades Únicas (tabla ou_clientes de Supabase, ver
//      oportunidades/esquema.sql): operación, presupuesto, zonas, habitaciones,
//      metros y lo que necesitan. Necesita la nube y SUPABASE_SERVICE_KEY.
//   2. La agenda del móvil (.vcf) que Pau comparte o adjunta en el chat.
//   3. Los clientes que Pau exporta de Inmoweb a .csv y adjunta.
//   (2 y 3 los lee lib/contactos.js; viven solo en la petición en curso y no
//   se guardan en ningún sitio.) CasteBot NO es fuente de este cruce.
//
//  El cálculo es el de Oportunidades (coincidencia() de lib/oportunidades.js),
//  que acota el exceso sobre presupuesto y ESCRIBE LOS MOTIVOS. Aquí solo se
//  adapta a la cartera web: lo que el listado no dice (garaje, terraza…) va
//  como «sin comprobar», nunca como «no tiene». Un contacto que no dice qué
//  busca cuenta como «sin criterios» y no se cruza.
//
//  Solo lectura. Datos personales al mínimo: al modelo le llegan el nombre,
//  lo que busca y el presupuesto; el teléfono, solo si Pau lo pide; el correo
//  y las notas, nunca. La salida va acotada en caracteres.
// ============================================================================

import { coincidencia, CARACTERISTICAS } from "./oportunidades.js";
import { CIUDADES_ASTURIAS } from "./oportunidades-extras.js";
import { clienteDeContacto } from "./contactos.js";

export const MAX_RESULTADOS = 8;
export const MAX_SALIDA = 9000; // caracteres como mucho que vuelven a Clara
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
  return `${c.alias} · ${c.fuente} · busca: ${busca.join(", ")}${c.telefono ? ` · tel. ${c.telefono}` : ""}`;
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

// ---------------------------------------------------------------------------
//  La herramienta entera
//  deps: { claveSync, nube (bool: clave validada), obtenerCartera,
//          listas: [{ tipo, nombre, contactos, recortado }] adjuntas en esta
//          conversación (lib/contactos.js), leerClientes (opcional, pruebas) }
// ---------------------------------------------------------------------------
const recorta = (t) => (t.length > MAX_SALIDA ? t.slice(0, MAX_SALIDA) + "\n[…recortado para no pasar de " + MAX_SALIDA + " caracteres: pide a Pau que acote la búsqueda]" : t);

export async function cruzarClientes(input, deps = {}) {
  const { claveSync, nube, obtenerCartera } = deps;
  const listas = Array.isArray(deps.listas) ? deps.listas.filter((l) => l?.ok !== false && Array.isArray(l?.contactos)) : [];
  if ((!nube || !claveSync) && !listas.length) {
    return (
      "Ahora mismo no tengo clientes con los que cruzar. Dos caminos: " +
      "1) la nube activa (SUPABASE_URL y SUPABASE_ANON_KEY en Vercel, la clave de sincronización en 🧠 Memoria y, para los clientes de Oportunidades Únicas, SUPABASE_SERVICE_KEY y oportunidades/esquema.sql); " +
      "2) que Pau adjunte o comparta en este chat su agenda del móvil (.vcf) o su lista de clientes exportada de Inmoweb a CSV. Díselo a Pau con el paso concreto."
    );
  }
  const modo = input?.modo === "cliente" ? "cliente" : input?.modo === "piso" ? "piso" : null;
  if (!modo) return "Indica el modo: «piso» (qué clientes encajan con un piso, con su referencia) o «cliente» (qué pisos le encajan a un cliente, con su nombre).";
  const conTelefono = input?.incluir_telefono === true;
  const leerClientes = deps.leerClientes || ((o) => leerClientesOportunidades(o));

  const [ou, cartera] = await Promise.all([
    nube && claveSync ? leerClientes({ conTelefono }) : Promise.resolve({ ok: false, motivo: "sin la nube activa en esta conversación" }),
    obtenerCartera().catch((e) => ({ items: [], errores: [String(e?.message || e)] })),
  ]);
  const deListas = listas.map((l) => {
    const fuente = l.tipo === "vcard" ? `agenda del móvil (${l.nombre})` : `CSV de clientes (${l.nombre})`;
    const todos = l.contactos.map((c) => clienteDeContacto(c, fuente, conTelefono));
    return { l, fuente, con: todos.filter((c) => !c.sinCriterios), sin: todos.filter((c) => c.sinCriterios).length };
  });
  const clientes = [...(ou.ok ? ou.clientes : []), ...deListas.flatMap((d) => d.con)];
  const pisos = (cartera?.items || []).map(inmuebleDeCartera);
  const fuentes = [
    `Oportunidades Únicas: ${ou.ok ? `${ou.clientes.length} cliente(s) que buscan` : `no disponible — ${ou.motivo}`}`,
    ...(deListas.length
      ? deListas.map((d) => `${d.fuente[0].toUpperCase() + d.fuente.slice(1)}: ${d.con.length} con criterios de búsqueda, ${d.sin} sin criterios (no se cruzan)${d.l.recortado ? ", archivo recortado" : ""}`)
      : ["Agenda (.vcf) o CSV de Inmoweb: ninguno adjunto en esta conversación"]),
    `Cartera web: ${pisos.length} piso(s)${cartera?.errores?.length ? ` (avisos: ${cartera.errores.join("; ")})` : ""}`,
  ];
  const cabecera = `Fuentes leídas ahora:\n- ${fuentes.join("\n- ")}`;
  const pie =
    "\n\nNotas: la puntuación (0-100) es la de Oportunidades Únicas y cada punto lleva su motivo; «sin comprobar» es lo que la cartera web no publica en el listado (ábrelo con ficha_inmueble si importa). " +
    "Los criterios de la agenda y del CSV salen de sus notas o columnas: confírmalos con el cliente. Esos contactos solo valen en esta conversación y no se guardan. No inventes nada que no esté aquí." +
    (conTelefono ? "" : " Por discreción no van teléfonos: si Pau los quiere, vuelve a llamar con incluir_telefono.");

  if (!clientes.length) {
    return recorta(
      `${cabecera}\n\nNo hay clientes con criterios de búsqueda con los que cruzar. ` +
        "Para tenerlos: clientes dados de alta en Oportunidades Únicas, o contactos cuya nota diga qué buscan (zona, presupuesto, habitaciones), o un CSV con esas columnas."
    );
  }

  if (modo === "piso") {
    const q = String(input?.referencia || "").trim();
    if (!q) return "Dime la referencia del piso (la que sale en mi_cartera) para buscarle clientes.";
    const qn = sinTildes(q).replace(/[^a-z0-9]/g, "");
    const piso = pisos.find((p) => sinTildes(p.referencia).replace(/[^a-z0-9]/g, "") === qn || String(p.url || "").includes(`-es${q.replace(/^es/i, "")}.html`));
    if (!piso) {
      return recorta(`${cabecera}\n\nNo encuentro la referencia «${q.slice(0, 40)}» en la cartera publicada. Referencias publicadas: ${pisos.map((p) => p.referencia).filter(Boolean).slice(0, 60).join(", ") || "ninguna leída"}.`);
    }
    const lista = cruzarPorPiso(piso, clientes);
    const cuerpo = lista.length
      ? lista.map((m, i) => `${i + 1}. ${lineaCliente(m.cliente)}\n   ${lineaEncaje(m)}`).join("\n")
      : "Ningún cliente encaja con este piso (todos puntúan 0).";
    return recorta(`${cabecera}\n\nPiso: ${lineaPiso(piso)}\n\nClientes que encajan (de mejor a peor, máximo ${MAX_RESULTADOS}):\n${cuerpo}${pie}`);
  }

  const nombre = String(input?.cliente || "").trim().slice(0, 60);
  if (!nombre) return "Dime el nombre del cliente para buscarle pisos.";
  const encontrados = buscarClientes(clientes, nombre);
  if (!encontrados.length) {
    return recorta(`${cabecera}\n\nNo encuentro a «${nombre}» entre los clientes con criterios de búsqueda (si está en la agenda sin nota de lo que busca, no se puede cruzar). Algunos disponibles: ${clientes.map((c) => c.alias).slice(0, 40).join(", ")}.`);
  }
  if (encontrados.length > 3) {
    return recorta(`${cabecera}\n\nHay ${encontrados.length} clientes que se llaman parecido a «${nombre}»: ${encontrados.map(lineaCliente).slice(0, 10).join(" | ")}. Pregúntale a Pau cuál es (por la fuente o lo que busca).`);
  }
  const bloques = encontrados.map((c) => {
    const lista = cruzarPorCliente(c, pisos);
    const cuerpo = lista.length
      ? lista.map((m, i) => `${i + 1}. ${lineaPiso(m.inmueble)}\n   ${lineaEncaje(m)}`).join("\n")
      : "Ningún piso de la cartera le encaja (todos puntúan 0).";
    return `Cliente: ${lineaCliente(c)}\nPisos que le encajan (de mejor a peor, máximo ${MAX_RESULTADOS}):\n${cuerpo}`;
  });
  return recorta(`${cabecera}\n\n${bloques.join("\n\n")}${pie}`);
}

// Esquema que ve Clara (solo con la nube activa).
export const HERRAMIENTA_CRUZAR = {
  name: "cruzar_clientes",
  description:
    "Cruza la cartera publicada con los clientes que buscan: los de Oportunidades Únicas (con la nube) y los de la agenda del móvil (.vcf) o del CSV de Inmoweb que Pau haya adjuntado en esta conversación. Modo «piso»: qué clientes encajan con un piso (pasa su referencia). Modo «cliente»: qué pisos le encajan a un cliente (pasa su nombre). Devuelve una puntuación de 0 a 100 con los motivos escritos, lo que no encaja y lo que está sin comprobar. Solo lectura. Sin teléfonos salvo que Pau los pida.",
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
