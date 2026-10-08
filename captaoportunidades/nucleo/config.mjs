// ============================================================================
//  Contexto de ejecución, configuración y catálogos configurables.
//  Los catálogos (municipios, fuentes, tipos de inmueble, motivos de descarte)
//  se siembran una vez; el usuario puede AÑADIR y desactivar entradas, así que
//  la aplicación no queda limitada a una lista fija. Los registros guardan el
//  TEXTO de la etiqueta (legible en informes y exportaciones).
// ============================================================================
import { insertar, actualizar } from "./bd.mjs";
import { limpiar, exige } from "./campos.mjs";
import { ErrorApp, noEncontrado, normaliza, slug, conflicto, invalido } from "./util.mjs";
import {
  CONFIG_DEFECTO, TIPOS_CATALOGO, MUNICIPIOS_ASTURIAS, FUENTES_DEFECTO, TIPOS_INMUEBLE_DEFECTO, MOTIVOS_DESCARTE_DEFECTO,
} from "./catalogos.mjs";
import * as auditoria from "./auditoria.mjs";

const SIEMBRA = {
  municipio: MUNICIPIOS_ASTURIAS,
  fuente: FUENTES_DEFECTO,
  tipo_inmueble: TIPOS_INMUEBLE_DEFECTO,
  motivo_descarte: MOTIVOS_DESCARTE_DEFECTO,
};

export function crearCtx(bd, reloj, modo = "real") {
  const ctx = { bd, reloj, modo, _cfg: null, _cat: null };
  ctx.config = () => (ctx._cfg ??= leerConfig(ctx));
  ctx.usuario = () => ctx.config().usuario.nombre || "Usuario";
  /** Devuelve la etiqueta canónica del catálogo para un texto, o null si no existe. */
  ctx.cat = (tipo, texto) => {
    if (!ctx._cat) {
      ctx._cat = {};
      for (const f of ctx.bd.todos("SELECT tipo, etiqueta FROM catalogo")) {
        (ctx._cat[f.tipo] ??= new Map()).set(normaliza(f.etiqueta), f.etiqueta);
      }
    }
    return ctx._cat[tipo]?.get(normaliza(texto)) ?? null;
  };
  ctx.refrescarCatalogos = () => { ctx._cat = null; };
  return ctx;
}

export function sembrarCatalogos(bd) {
  bd.transaccion(() => {
    for (const [tipo, valores] of Object.entries(SIEMBRA)) {
      if (bd.valor("SELECT COUNT(*) FROM catalogo WHERE tipo = ?", [tipo]) > 0) continue;
      valores.forEach((etiqueta, i) => insertar(bd, "catalogo", { tipo, valor: slug(etiqueta), etiqueta, activo: 1, orden: i }));
    }
  });
}

// --------------------------------------------------------- configuración ----
const DEF_CONFIG = {
  inmobiliaria: {
    nombre: { t: "texto", etq: "el nombre", max: 120 },
    telefono: { t: "tel", etq: "el teléfono" },
    email: { t: "email", etq: "el correo" },
    web: { t: "url", etq: "la web" },
    direccion: { t: "texto", etq: "la dirección", max: 200 },
  },
  usuario: { nombre: { t: "texto", etq: "tu nombre", req: true, max: 80 } },
  referencias: {
    inmueble_prefijo: { t: "texto", etq: "el prefijo de inmuebles", req: true, max: 10 },
    inmueble_digitos: { t: "int", etq: "las cifras de la referencia", min: 1, max: 8 },
    oportunidad_prefijo: { t: "texto", etq: "el prefijo de oportunidades", req: true, max: 10 },
  },
  avisos: {
    encargo_dias: { t: "int", etq: "los días de aviso de encargos", min: 0, max: 365 },
    demanda_obsoleta_dias: { t: "int", etq: "los días para considerar caducada una demanda", min: 1, max: 730 },
    copia_dias: { t: "int", etq: "los días para avisar de copia de seguridad", min: 1, max: 365 },
  },
  copias: {
    automaticas: { t: "bool", etq: "las copias automáticas" },
    conservar: { t: "int", etq: "las copias a conservar", min: 1, max: 60 },
  },
};

export function leerConfig(ctx) {
  const cfg = structuredClone(CONFIG_DEFECTO);
  for (const f of ctx.bd.todos("SELECT clave, valor FROM configuracion")) {
    try { if (cfg[f.clave]) Object.assign(cfg[f.clave], JSON.parse(f.valor)); } catch { /* valor dañado: se usa el de fábrica */ }
  }
  return cfg;
}

export function guardarConfig(ctx, seccion, entrada) {
  const def = DEF_CONFIG[seccion];
  if (!def) throw noEncontrado("La sección de configuración");
  const { valores, errores } = limpiar(def, entrada, { parcial: true });
  if (seccion === "referencias") {
    for (const k of ["inmueble_prefijo", "oportunidad_prefijo"]) {
      if (valores[k] && !/^[A-Za-z0-9-]{1,10}$/.test(valores[k])) errores[k] = "El prefijo solo puede llevar letras, números y guiones.";
    }
  }
  exige(errores);
  const actual = leerConfig(ctx)[seccion];
  const nuevo = { ...actual, ...valores };
  ctx.bd.transaccion(() => {
    ctx.bd.ejecutar("INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor", [seccion, JSON.stringify(nuevo)]);
    auditoria.registrar(ctx, "configuracion", 0, "editar", { campo: seccion, resumen: `Se modificó la configuración (${seccion}).` });
  });
  ctx._cfg = null;
  return leerConfig(ctx);
}

// -------------------------------------------------------------- catálogos ----
export function listarCatalogo(ctx, tipo, { soloActivos = false } = {}) {
  if (!TIPOS_CATALOGO[tipo]) throw invalido("Tipo de catálogo desconocido.");
  return ctx.bd.todos(
    `SELECT id, tipo, valor, etiqueta, activo, orden FROM catalogo WHERE tipo = ? ${soloActivos ? "AND activo = 1" : ""} ORDER BY orden, etiqueta`,
    [tipo],
  );
}

export function todosLosCatalogos(ctx) {
  const salida = {};
  for (const tipo of Object.keys(TIPOS_CATALOGO)) salida[tipo] = listarCatalogo(ctx, tipo);
  return salida;
}

export function anadirCatalogo(ctx, tipo, etiqueta) {
  if (!TIPOS_CATALOGO[tipo]) throw invalido("Tipo de catálogo desconocido.");
  const texto = String(etiqueta ?? "").replace(/\s+/g, " ").trim();
  if (!texto) throw invalido("Escribe el nombre que quieres añadir.", { etiqueta: "Escribe el nombre que quieres añadir." });
  if (texto.length > 80) throw invalido("El nombre es demasiado largo (máximo 80 caracteres).", { etiqueta: "Demasiado largo." });
  const existente = ctx.bd.uno("SELECT id, etiqueta, activo FROM catalogo WHERE tipo = ? AND (valor = ? OR norm(etiqueta) = ?)", [tipo, slug(texto), normaliza(texto)]);
  if (existente) {
    if (!existente.activo) {
      actualizar(ctx.bd, "catalogo", existente.id, { activo: 1 });
      ctx.refrescarCatalogos();
      return { ...existente, activo: 1, reactivado: true };
    }
    throw conflicto("catalogo_duplicado", `«${existente.etiqueta}» ya está en la lista.`);
  }
  const orden = Number(ctx.bd.valor("SELECT COALESCE(MAX(orden), 0) + 1 FROM catalogo WHERE tipo = ?", [tipo]));
  const id = insertar(ctx.bd, "catalogo", { tipo, valor: slug(texto), etiqueta: texto, activo: 1, orden });
  auditoria.registrar(ctx, "catalogo", id, "crear", { resumen: `Nueva entrada en ${TIPOS_CATALOGO[tipo]}.` });
  ctx.refrescarCatalogos();
  return ctx.bd.uno("SELECT id, tipo, valor, etiqueta, activo, orden FROM catalogo WHERE id = ?", [id]);
}

export function activarCatalogo(ctx, id, activo) {
  const f = ctx.bd.uno("SELECT * FROM catalogo WHERE id = ?", [id]);
  if (!f) throw noEncontrado("La entrada del catálogo");
  actualizar(ctx.bd, "catalogo", id, { activo: activo ? 1 : 0 });
  auditoria.registrar(ctx, "catalogo", id, "editar", { campo: "activo", antes: String(f.activo), despues: activo ? "1" : "0" });
  ctx.refrescarCatalogos();
  return ctx.bd.uno("SELECT id, tipo, valor, etiqueta, activo, orden FROM catalogo WHERE id = ?", [id]);
}

/** Paginación común a todos los listados. */
export function paginacion(q = {}) {
  const limite = Math.min(200, Math.max(1, parseInt(q.limite, 10) || 50));
  const offset = Math.max(0, parseInt(q.offset, 10) || 0);
  return { limite, offset };
}

/** Escapa % _ \ para usar el texto en un LIKE. */
export function patronLike(texto) {
  // Los caracteres de control se quitan: un NUL truncaría el patrón en SQLite y casaría con todo.
  return `%${String(texto).replace(/[\u0000-\u001f]/g, "").replace(/[\\%_]/g, "\\$&")}%`;
}

export { ErrorApp };
