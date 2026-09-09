// ============================================================================
//  Escaparate 3D Pro — carga y normalización de la configuración del negocio
// ----------------------------------------------------------------------------
//  Regla de oro del producto: NINGÚN dato del negocio vive en el código. Todo
//  (nombre, colores, teléfonos, redes, carta, inmuebles) sale de negocio.json.
//  Así el mismo código sirve para 200 clientes con 200 despliegues distintos.
//
//  Orden de resolución (gana el primero que responda):
//    1. ?config=ruta-relativa.json   → para probar una config concreta
//    2. ?negocio=<id>                → una de las de config/ejemplos/
//    3. borrador guardado en el navegador por el panel /admin/  (vista previa)
//    4. config/negocio.json          → la del cliente en este despliegue
//  Y, si la config trae Firebase configurado, se superpone el documento
//  remoto para que el dueño pueda editar sin volver a desplegar.
// ============================================================================

export const CATALOGO = [
  { id: "castresana", archivo: "inmobiliaria-castresana.json", sector: "inmobiliaria", nombre: "Asesoría Castresana", real: true },
  { id: "la-vina", archivo: "restaurante-la-vina.json", sector: "restaurante", nombre: "Restaurante La Viña (Cenera)", real: true },
  { id: "inmobiliaria-ejemplo", archivo: "inmobiliaria-ejemplo.json", sector: "inmobiliaria", nombre: "Fincas Ejemplo (ficticia)", real: false },
  { id: "restaurante-ejemplo", archivo: "restaurante-ejemplo.json", sector: "restaurante", nombre: "Casa Ejemplo (ficticia)", real: false },
];

export const CLAVE_BORRADOR = "escaparate3d-pro:borrador";

/* --- Valores por defecto: lo mínimo para que la página no se rompa nunca --- */
export const POR_DEFECTO = {
  version: 1,
  id: "sin-configurar",
  sector: "inmobiliaria",
  nombre: "Tu negocio",
  eslogan: "",
  logoUrl: "",
  demo: { activa: false, aviso: "" },
  verificacion: { verificado: true, fuente: "", confirmado: [], pendiente: [] },
  // Paleta neutra del producto, a propósito: NO es la marca de ningún cliente,
  // para que "sigue con los colores de plantilla" sea una señal fiable en el
  // semáforo de producción (js/produccion.js).
  colores: { fondo: "#0f1115", acento: "#6c7cff", acento2: "#22c55e", texto: "#e9edf3" },
  contacto: {
    telefono: "", telefonoTexto: "", whatsapp: "", email: "",
    direccion: "", horario: "", mapaLat: null, mapaLng: null,
  },
  redes: { web: "", instagram: "", facebook: "", tiktok: "", googleBusiness: "", tripadvisor: "" },
  modulos: {
    pedidosDomicilio: false, reservas: false, qrMesas: false,
    catalogoInmuebles: false, valoracionGratis: false, pedirDemo: true,
  },
  datos: {
    modo: "local",
    api: { lead: "/api/lead", pedido: "", reserva: "" },
    firebase: { apiKey: "", authDomain: "", projectId: "", coleccionPedidos: "pedidos", coleccionReservas: "reservas", coleccionConfig: "negocios" },
  },
  carta: { preciosEjemplo: false, moneda: "€", aviso: "", categorias: [] },
  pedidos: { recogidaEnLocal: true, pedidoMinimo: 0, zonasReparto: [], formasPago: [], avisoLegal: "" },
  reservas: { maxComensales: 10, antelacionDias: 30, diasCerrado: [], turnos: [], aviso: "" },
  qr: { mesas: 0, prefijoMesa: "Mesa", destino: "carta" },
  inmuebles: { origenes: [], maxTarjetas3D: 24, maxEnMensaje: 12, proxyFotos: "", respaldo: [] },
  valoracion: { titulo: "¿Cuánto vale tu casa?", texto: "", preguntarDireccion: true, preciosZona: [] },
  // Quién vende el producto (no el negocio del cliente): es a donde llegan las
  // peticiones de "quiero esta demo para mi negocio". Se puede cambiar por
  // despliegue si algún día lo revende otra persona.
  comercial: {
    marca: "Escaparate 3D",
    responsable: "Pau Moralejo",
    whatsapp: "34672775721",
    email: "asesoriacastresana@gmail.com",
    web: "",
    titulo: "¿Te gusta? Esto mismo, con tu negocio dentro",
    texto: "Lo que estás viendo es una demo real, no un vídeo: se puede montar con tus datos, tus fotos, tus colores y tu teléfono. Dime qué negocio tienes y te preparo la tuya.",
    plazo: "Demo lista en pocos días con lo que ya tengas publicado.",
  },
};

/* --- Utilidades ----------------------------------------------------------- */

// Mezcla profunda, pero solo de objetos planos: los arrays se sustituyen enteros
// (si el cliente define 3 categorías de carta, son esas 3, no las de por defecto).
export function mezclar(base, encima) {
  if (Array.isArray(encima)) return encima.slice();
  if (encima === null || encima === undefined) return base;
  if (typeof encima !== "object" || typeof base !== "object" || base === null || Array.isArray(base)) return encima;
  const salida = { ...base };
  for (const [clave, valor] of Object.entries(encima)) {
    salida[clave] = clave in base ? mezclar(base[clave], valor) : valor;
  }
  return salida;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
function colorValido(valor, respaldo) {
  if (typeof valor === "number") return "#" + valor.toString(16).padStart(6, "0");
  return typeof valor === "string" && HEX.test(valor.trim()) ? valor.trim() : respaldo;
}

// Solo dejamos pasar enlaces http(s): así una config manipulada no puede colar
// un javascript: en un botón de la página.
export function enlaceSeguro(url) {
  const texto = String(url || "").trim();
  if (!texto) return "";
  try {
    const u = new URL(texto);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

// Teléfono en formato marcable y WhatsApp solo dígitos (wa.me no admite "+").
function telefonoLimpio(valor) {
  const texto = String(valor || "").replace(/[^\d+]/g, "");
  return texto.startsWith("+") ? "+" + texto.slice(1).replace(/\+/g, "") : texto;
}

export function normalizar(bruto) {
  const cfg = mezclar(POR_DEFECTO, bruto && typeof bruto === "object" ? bruto : {});
  cfg.sector = cfg.sector === "restaurante" ? "restaurante" : "inmobiliaria";
  cfg.nombre = String(cfg.nombre || POR_DEFECTO.nombre).slice(0, 120);
  cfg.colores = {
    fondo: colorValido(cfg.colores.fondo, POR_DEFECTO.colores.fondo),
    acento: colorValido(cfg.colores.acento, POR_DEFECTO.colores.acento),
    acento2: colorValido(cfg.colores.acento2, POR_DEFECTO.colores.acento2),
    texto: colorValido(cfg.colores.texto, POR_DEFECTO.colores.texto),
  };
  cfg.contacto.telefono = telefonoLimpio(cfg.contacto.telefono);
  cfg.contacto.telefonoTexto = String(cfg.contacto.telefonoTexto || cfg.contacto.telefono || "");
  cfg.contacto.whatsapp = String(cfg.contacto.whatsapp || "").replace(/\D/g, "");
  for (const red of Object.keys(cfg.redes)) cfg.redes[red] = enlaceSeguro(cfg.redes[red]);
  cfg.logoUrl = /^(https?:|\.\/|\/|data:image\/)/.test(String(cfg.logoUrl || "")) ? cfg.logoUrl : "";
  cfg.comercial.whatsapp = String(cfg.comercial.whatsapp || "").replace(/\D/g, "");
  cfg.comercial.web = enlaceSeguro(cfg.comercial.web);
  // Un módulo de otro sector no se enciende aunque venga a true en el JSON.
  if (cfg.sector === "restaurante") {
    cfg.modulos.catalogoInmuebles = false;
    cfg.modulos.valoracionGratis = false;
  } else {
    cfg.modulos.pedidosDomicilio = false;
    cfg.modulos.reservas = false;
    cfg.modulos.qrMesas = false;
  }
  return cfg;
}

/* --- Lectura -------------------------------------------------------------- */

async function leerJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

// Firestore por REST: sin SDK ni empaquetador. Devuelve null si no hay nada.
export function desdeFirestore(documento) {
  const campos = documento?.fields;
  if (!campos) return null;
  const valor = (v) => {
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return Number(v.doubleValue);
    if ("booleanValue" in v) return v.booleanValue;
    if ("nullValue" in v) return null;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(valor);
    if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, valor(x)]));
    return null;
  };
  return valor({ mapValue: { fields: campos } });
}

export function urlFirestore(fb, coleccion, id) {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(fb.projectId)}/databases/(default)/documents`;
  const ruta = `${base}/${encodeURIComponent(coleccion)}/${encodeURIComponent(id)}`;
  return fb.apiKey ? `${ruta}?key=${encodeURIComponent(fb.apiKey)}` : ruta;
}

// Ruta de config permitida: relativa y dentro de config/. Nunca una URL externa,
// para que nadie pueda montar una página con la marca del cliente y otros datos.
export function rutaConfigSegura(valor) {
  const texto = String(valor || "").trim();
  if (!texto || /^[a-z]+:/i.test(texto) || texto.startsWith("//") || texto.includes("..")) return "";
  return /^config\/[\w./-]+\.json$/.test(texto) ? texto : "";
}

export function archivoDeNegocio(id) {
  const ficha = CATALOGO.find((n) => n.id === String(id || "").trim());
  return ficha ? `config/ejemplos/${ficha.archivo}` : "";
}

export async function fetchConfig({ parametros = new URLSearchParams(location.search), base = "" } = {}) {
  const candidatas = [];
  const ruta = rutaConfigSegura(parametros.get("config"));
  if (ruta) candidatas.push(base + ruta);
  const porId = archivoDeNegocio(parametros.get("negocio"));
  if (porId) candidatas.push(base + porId);

  // Borrador del panel de administración (vista previa sin desplegar).
  if (!candidatas.length && parametros.get("borrador") !== "0") {
    try {
      const guardado = localStorage.getItem(CLAVE_BORRADOR);
      if (guardado) {
        const cfg = normalizar(JSON.parse(guardado));
        return { config: await conFirebase(cfg), origen: "borrador del panel", avisos: [] };
      }
    } catch { /* si el navegador bloquea el almacenamiento, seguimos */ }
  }

  candidatas.push(base + "config/negocio.json");

  const avisos = [];
  for (const url of candidatas) {
    try {
      const cfg = normalizar(await leerJson(url));
      return { config: await conFirebase(cfg), origen: url, avisos };
    } catch (e) {
      avisos.push(String(e.message || e));
    }
  }
  return { config: normalizar({}), origen: "valores por defecto", avisos };
}

// Si el cliente ya está en Firebase, el documento remoto manda sobre el JSON.
async function conFirebase(cfg) {
  const fb = cfg.datos?.firebase;
  if (cfg.datos?.modo !== "firebase" || !fb?.projectId) return cfg;
  try {
    const doc = await leerJson(urlFirestore(fb, fb.coleccionConfig || "negocios", cfg.id));
    const remoto = desdeFirestore(doc);
    return remoto ? normalizar(mezclar(cfg, remoto)) : cfg;
  } catch {
    return cfg; // sin conexión o sin permisos: seguimos con el JSON local
  }
}
