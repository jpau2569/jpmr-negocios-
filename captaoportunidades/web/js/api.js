// ============================================================================
//  Cliente de la API local + estado de sesión (modo real/demo y catálogos).
//  El navegador NO guarda datos de negocio: solo recuerda el modo elegido.
//  Cada petición lleva X-Captao (anti-CSRF) y X-Captao-Modo.
// ============================================================================
export const sesion = { modo: leerModo(), cat: null };

function leerModo() {
  try { return localStorage.getItem("captao.modo") === "demo" ? "demo" : "real"; } catch { return "real"; }
}
export function fijarModo(modo) {
  sesion.modo = modo === "demo" ? "demo" : "real";
  try { localStorage.setItem("captao.modo", sesion.modo); } catch { /* sin almacenamiento: dura la sesión */ }
}

export class ApiError extends Error {
  constructor(estado, cuerpo) {
    const e = cuerpo?.error || {};
    super(e.mensaje || "No se pudo completar la operación.");
    this.estado = estado;
    this.codigo = e.codigo || "error";
    this.campos = e.campos || {};
    this.extra = e;
  }
}

function construirUrl(ruta, query) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== "") p.set(k, v);
  const s = p.toString();
  return s ? `${ruta}?${s}` : ruta;
}

async function pedir(metodo, ruta, { query, cuerpo } = {}) {
  let r;
  try {
    r = await fetch(construirUrl(ruta, query), {
      method: metodo,
      headers: { "x-captao": "1", "x-captao-modo": sesion.modo, ...(cuerpo !== undefined ? { "content-type": "application/json" } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: { codigo: "sin_conexion", mensaje: "No se puede contactar con el programa. ¿Se ha cerrado la ventana negra (o terminal) donde lo abriste? Vuelve a abrirlo y recarga esta página." } });
  }
  let datos = null;
  try { datos = await r.json(); } catch { /* respuesta sin cuerpo */ }
  if (!r.ok) throw new ApiError(r.status, datos);
  return datos;
}

export const api = {
  get: (ruta, query) => pedir("GET", ruta, { query }),
  post: (ruta, cuerpo = {}) => pedir("POST", ruta, { cuerpo }),
  put: (ruta, cuerpo = {}) => pedir("PUT", ruta, { cuerpo }),
  del: (ruta) => pedir("DELETE", ruta),
  /** Enlace para descargas directas (el navegador no puede mandar cabeceras en un <a>). */
  urlDescarga: (ruta, query = {}) => construirUrl(ruta, { ...query, modo: sesion.modo }),
  /** Subida de un archivo en bruto (copias de seguridad). */
  async subir(ruta, archivo) {
    const r = await fetch(ruta, { method: "POST", headers: { "x-captao": "1", "x-captao-modo": sesion.modo, "content-type": "application/octet-stream" }, body: archivo });
    let datos = null;
    try { datos = await r.json(); } catch { /* sin cuerpo */ }
    if (!r.ok) throw new ApiError(r.status, datos);
    return datos;
  },
};

export async function cargarCatalogos(forzar = false) {
  if (!sesion.cat || forzar) sesion.cat = await api.get("/api/catalogos");
  return sesion.cat;
}

// -------- accesos cómodos a los catálogos ya cargados --------
export const enums = () => sesion.cat.enumeraciones;
export const etiqueta = (lista, clave) => (enums()[lista] || []).find((x) => x.clave === clave)?.etiqueta ?? clave ?? "";
export const colorDe = (lista, clave) => (enums()[lista] || []).find((x) => x.clave === clave)?.color || "gris";
export const opciones = (lista) => (enums()[lista] || []).map((x) => ({ valor: x.clave, texto: x.etiqueta }));
export const catalogoActivo = (tipo) => (sesion.cat.catalogos[tipo] || []).filter((x) => x.activo).map((x) => x.etiqueta);
