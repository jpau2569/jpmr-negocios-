// ============================================================================
//  Validación de entradas. Cada entidad declara una LISTA BLANCA de campos:
//  lo que no esté aquí se ignora (así nadie puede colar "id", "creado_en" o
//  "no_contactar" por la API). Los mensajes están escritos para una persona,
//  no para un programador.
//
//  Tipos: texto, largo, enum, int, num, fecha, hora, bool, tri, url, email,
//         tel, lista, fk.
//  Opciones: etq (nombre en pantalla), req, max, min, op (valores válidos),
//            def (valor por defecto al crear), sens (dato personal o texto
//            libre: el historial NO guarda su valor), cat (catálogo).
// ============================================================================
import { fechaValida, invalido } from "./util.mjs";
import * as C from "./catalogos.mjs";

// Controles y caracteres bidireccionales (permiten falsear cómo se ve un texto).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/** "245.000" → 245000, "1.234,56" → 1234.56, "95,5" → 95.5, "95.5" → 95.5 */
export function parseNumeroEs(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v !== "string") return NaN;
  let s = v.trim().replace(/[€\s]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

function aFecha(v) {
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  const iso = m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
  return fechaValida(iso) ? iso : null;
}

const vacio = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

function convertir(f, v, cat) {
  const etq = f.etq;
  switch (f.t) {
    case "texto":
    case "largo": {
      if (typeof v !== "string" && typeof v !== "number") return { error: `${etq}: debe ser un texto.` };
      let s = String(v).replace(CONTROL, "");
      if (f.t === "texto") s = s.replace(/\s*\n\s*/g, " ");
      s = s.trim();
      const max = f.max ?? (f.t === "largo" ? 4000 : 200);
      if (s.length > max) return { error: `${etq}: es demasiado largo (máximo ${max} caracteres).` };
      if (f.cat && cat) {
        const canon = cat(f.cat, s);
        if (canon) return { valor: canon };
        if (!f.libre) return { error: `${etq}: «${s}» no está en el catálogo. Añádelo antes en Configuración.` };
      }
      return { valor: s };
    }
    case "enum": {
      const s = String(v).trim();
      return f.op.includes(s) ? { valor: s } : { error: `${etq}: el valor «${s}» no es válido.` };
    }
    case "int": {
      const n = parseNumeroEs(v);
      if (!Number.isInteger(n)) return { error: `${etq}: debe ser un número entero.` };
      if (n < (f.min ?? 0)) return { error: `${etq}: no puede ser menor que ${f.min ?? 0}.` };
      if (n > (f.max ?? 1e9)) return { error: `${etq}: no puede ser mayor que ${f.max ?? 1e9}.` };
      return { valor: n };
    }
    case "num": {
      const n = parseNumeroEs(v);
      if (!Number.isFinite(n)) return { error: `${etq}: debe ser un número (por ejemplo 245000 o 95,5).` };
      if (n < (f.min ?? 0)) return { error: `${etq}: no puede ser menor que ${f.min ?? 0}.` };
      if (n > (f.max ?? 1e10)) return { error: `${etq}: es demasiado grande.` };
      return { valor: Math.round(n * 100) / 100 };
    }
    case "fecha": {
      const iso = aFecha(v);
      return iso ? { valor: iso } : { error: `${etq}: fecha no válida (usa día/mes/año, por ejemplo 15/03/2026).` };
    }
    case "hora": {
      const s = String(v).trim();
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? { valor: s } : { error: `${etq}: hora no válida (usa HH:MM, por ejemplo 09:30).` };
    }
    case "bool": {
      if (v === true || v === 1 || v === "1" || v === "true" || v === "si" || v === "sí") return { valor: 1 };
      if (v === false || v === 0 || v === "0" || v === "false" || v === "no") return { valor: 0 };
      return { error: `${etq}: debe ser sí o no.` };
    }
    case "tri": {
      if (v === true || v === 1 || v === "1" || v === "si" || v === "sí" || v === "true") return { valor: 1 };
      if (v === false || v === 0 || v === "0" || v === "no" || v === "false") return { valor: 0 };
      if (v === "desconocido") return { valor: null };
      return { error: `${etq}: debe ser sí, no o desconocido.` };
    }
    case "url": {
      const s = String(v).trim();
      if (s.length > 2000) return { error: `${etq}: el enlace es demasiado largo.` };
      let u;
      try { u = new URL(s); } catch { return { error: `${etq}: no parece un enlace válido (debe empezar por https://).` }; }
      if (!/^https?:$/.test(u.protocol)) return { error: `${etq}: solo se admiten enlaces http o https.` };
      if (u.username || u.password) return { error: `${etq}: el enlace no debe llevar usuario ni contraseña.` };
      return { valor: u.href };
    }
    case "email": {
      const s = String(v).trim();
      if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return { error: `${etq}: no parece un correo válido.` };
      return { valor: s };
    }
    case "tel": {
      const s = String(v).trim();
      if (s.length > 25 || !/^[+\d][\d\s().-]*$/.test(s) || s.replace(/\D/g, "").length < 6) {
        return { error: `${etq}: no parece un teléfono válido.` };
      }
      return { valor: s };
    }
    case "lista": {
      let arr = v;
      if (typeof v === "string") arr = v.split(/[,;\n]/);
      if (!Array.isArray(arr)) return { error: `${etq}: debe ser una lista.` };
      const out = [];
      for (const x of arr) {
        const s = String(x ?? "").replace(CONTROL, "").trim();
        if (!s) continue;
        if (s.length > (f.max ?? 80)) return { error: `${etq}: un elemento es demasiado largo.` };
        let canon = s;
        if (f.cat && cat) canon = cat(f.cat, s) || s;
        if (f.op && !f.op.includes(canon)) return { error: `${etq}: el valor «${s}» no es válido.` };
        if (!out.includes(canon)) out.push(canon);
      }
      if (out.length > 50) return { error: `${etq}: demasiados elementos.` };
      return { valor: out };
    }
    case "fk": {
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? { valor: n } : { error: `${etq}: referencia no válida.` };
    }
    default:
      return { error: `${etq}: tipo de campo desconocido.` };
  }
}

/**
 * @returns {{valores: object, errores: object}} errores: { campo: mensaje }
 */
export function limpiar(def, entrada, { parcial = false, cat = null } = {}) {
  const valores = {};
  const errores = {};
  const src = entrada && typeof entrada === "object" ? entrada : {};
  for (const [k, f] of Object.entries(def)) {
    const presente = Object.prototype.hasOwnProperty.call(src, k);
    if (!presente) {
      if (!parcial) {
        if (f.def !== undefined) valores[k] = typeof f.def === "function" ? f.def() : f.def;
        else if (f.req) errores[k] = `Falta indicar: ${f.etq}.`;
      }
      continue;
    }
    const v = src[k];
    if (vacio(v)) {
      if (f.req) errores[k] = `Falta indicar: ${f.etq}.`;
      else if (f.t === "lista") valores[k] = [];
      else if (f.def !== undefined && !parcial) valores[k] = typeof f.def === "function" ? f.def() : f.def;
      else valores[k] = null;
      continue;
    }
    const r = convertir(f, v, cat);
    if (r.error) errores[k] = r.error;
    else valores[k] = r.valor;
  }
  return { valores, errores };
}

/** Lanza 422 con el mensaje principal y el detalle por campo. */
export function exige(errores, mensaje = "Revisa los campos marcados.") {
  const campos = Object.keys(errores);
  if (campos.length) throw invalido(campos.length === 1 ? errores[campos[0]] : mensaje, errores);
}

const ops = C.claves;
const T = (etq, o = {}) => ({ t: "texto", etq, ...o });
const L = (etq, o = {}) => ({ t: "largo", etq, sens: true, ...o });

// -------------------------------------------------------------- entidades ----
export const CONTACTO = {
  nombre: T("el nombre", { req: true, max: 120, sens: true }),
  apellidos: T("los apellidos", { max: 160, sens: true }),
  empresa: T("la empresa", { max: 160, sens: true }),
  telefono: { t: "tel", etq: "el teléfono", sens: true },
  email: { t: "email", etq: "el correo electrónico", sens: true },
  canal_preferido: { t: "enum", etq: "el canal preferido", op: ops(C.CANAL_PREFERIDO) },
  es_propietario: { t: "bool", etq: "propietario" },
  es_comprador: { t: "bool", etq: "comprador" },
  procedencia: { t: "enum", etq: "la procedencia de los datos", op: ops(C.PROCEDENCIAS) },
  procedencia_detalle: T("el detalle de la procedencia", { max: 300, sens: true }),
  motivo_venta: L("el motivo de venta", { max: 1000 }),
  plazo_venta: { t: "enum", etq: "el plazo previsto de venta", op: ops(C.PLAZOS_VENTA) },
  notas: L("las notas", { max: 4000 }),
};

export const HABILITACION = {
  canal: { t: "enum", etq: "el canal", req: true, op: ops(C.CANALES) },
  estado: { t: "enum", etq: "el estado", req: true, op: ops(C.ESTADOS_HABILITACION) },
  base: { t: "enum", etq: "la base de la comunicación", op: ops(C.BASES_COMUNICACION) },
  evidencia: L("la evidencia", { max: 500 }),
  fecha_autorizacion: { t: "fecha", etq: "la fecha de autorización" },
  fecha_baja: { t: "fecha", etq: "la fecha de la oposición o baja" },
  fecha_robinson: { t: "fecha", etq: "la fecha de comprobación de la Lista Robinson" },
};

export const OPORTUNIDAD = {
  fuente: T("la fuente", { req: true, max: 80, cat: "fuente" }),
  fuente_detalle: T("el detalle de la fuente", { max: 200, sens: true }),
  enlace: { t: "url", etq: "el enlace" },
  fecha_deteccion: { t: "fecha", etq: "la fecha de detección" },
  tipo_inmueble: T("el tipo de inmueble", { req: true, max: 80, cat: "tipo_inmueble" }),
  municipio: T("el municipio", { req: true, max: 80, cat: "municipio", libre: true }),
  zona: T("la zona", { max: 160 }),
  titulo: T("el título", { max: 200, sens: true }),
  precio_anunciado: { t: "num", etq: "el precio anunciado" },
  superficie_m2: { t: "num", etq: "la superficie", min: 1, max: 1e6 },
  habitaciones: { t: "int", etq: "las habitaciones", max: 60 },
  banos: { t: "int", etq: "los baños", max: 60 },
  caracteristicas: L("las características", { max: 2000 }),
  clasificacion_anunciante: { t: "enum", etq: "la clasificación del anunciante", op: ops(C.CLASIFICACION_ANUNCIANTE), def: "sin_verificar" },
  evidencia_clasificacion: L("la evidencia de la clasificación", { max: 500 }),
  contacto_id: { t: "fk", etq: "el propietario relacionado" },
  responsable: T("el responsable", { max: 80 }),
  proxima_accion: T("la próxima acción", { max: 200, sens: true }),
  proxima_accion_fecha: { t: "fecha", etq: "la fecha de la próxima acción" },
  verificacion_contacto: { t: "enum", etq: "la verificación de contacto", op: ops(C.VERIFICACION_CONTACTO) },
  verificacion_evidencia: L("la evidencia de la verificación", { max: 500 }),
  notas: L("las notas", { max: 4000 }),
};

export const INMUEBLE = {
  referencia: T("la referencia", { max: 40 }),
  titulo: T("el título", { max: 200, sens: true }),
  tipo: T("el tipo de inmueble", { req: true, max: 80, cat: "tipo_inmueble" }),
  operacion: { t: "enum", etq: "la operación", op: ops(C.OPERACIONES), def: "venta" },
  municipio: T("el municipio", { req: true, max: 80, cat: "municipio", libre: true }),
  zona: T("la zona", { max: 160 }),
  direccion_interna: T("la dirección interna", { max: 300, sens: true }),
  ubicacion_publica: T("la ubicación pública", { max: 200 }),
  superficie_m2: { t: "num", etq: "la superficie", min: 1, max: 1e6 },
  tipo_superficie: { t: "enum", etq: "el tipo de superficie", op: ops(C.TIPOS_SUPERFICIE), def: "desconocida" },
  habitaciones: { t: "int", etq: "las habitaciones", max: 60 },
  banos: { t: "int", etq: "los baños", max: 60 },
  planta: T("la planta", { max: 20 }),
  ascensor: { t: "tri", etq: "el ascensor" },
  garaje: { t: "tri", etq: "el garaje" },
  terraza: { t: "tri", etq: "la terraza" },
  estado_conservacion: { t: "enum", etq: "el estado de conservación", op: ops(C.ESTADOS_CONSERVACION) },
  caracteristicas: L("las características", { max: 2000 }),
  precio_actual: { t: "num", etq: "el precio" },
  descripcion_comercial: L("la descripción comercial", { max: 5000 }),
  notas_internas: L("las notas internas", { max: 5000 }),
  estado_comercial: { t: "enum", etq: "el estado comercial", op: ops(C.ESTADOS_COMERCIALES), def: "en_preparacion" },
  datos_pendientes: { t: "lista", etq: "los datos pendientes de confirmar", max: 60 },
};

export const ENCARGO = {
  tipo: { t: "enum", etq: "el tipo de encargo", op: ops(C.TIPOS_ENCARGO), def: "venta" },
  exclusividad: { t: "bool", etq: "la exclusividad", def: 0 },
  fecha_encargo: { t: "fecha", etq: "la fecha del encargo" },
  vigencia_hasta: { t: "fecha", etq: "la vigencia" },
  honorarios_tipo: { t: "enum", etq: "el tipo de honorarios", op: ops(C.HONORARIOS_TIPO), def: "sin_definir" },
  honorarios_valor: { t: "num", etq: "los honorarios" },
  honorarios_notas: L("las notas de honorarios", { max: 500 }),
  estado: { t: "enum", etq: "el estado del encargo", op: ops(C.ESTADOS_ENCARGO), def: "vigente" },
  notas: L("las notas", { max: 1000 }),
};

export const DEMANDA = {
  contacto_id: { t: "fk", etq: "el comprador", req: true },
  nombre: T("el nombre de la demanda", { max: 120, sens: true }),
  operacion: { t: "enum", etq: "la operación", op: ops(C.OPERACIONES_DEMANDA), def: "compra" },
  municipios: { t: "lista", etq: "los municipios", max: 80, cat: "municipio" },
  zonas: T("las zonas", { max: 300, sens: true }),
  presupuesto_min: { t: "num", etq: "el presupuesto mínimo" },
  presupuesto_max: { t: "num", etq: "el presupuesto máximo" },
  tipos: { t: "lista", etq: "los tipos de inmueble", max: 80, cat: "tipo_inmueble" },
  superficie_min: { t: "num", etq: "la superficie mínima", min: 1, max: 1e6 },
  habitaciones_min: { t: "int", etq: "las habitaciones mínimas", max: 60 },
  banos_min: { t: "int", etq: "los baños mínimos", max: 60 },
  ascensor: { t: "enum", etq: "el ascensor", op: ops(C.NIVEL_REQUISITO), def: "indiferente" },
  garaje: { t: "enum", etq: "el garaje", op: ops(C.NIVEL_REQUISITO), def: "indiferente" },
  terraza: { t: "enum", etq: "la terraza", op: ops(C.NIVEL_REQUISITO), def: "indiferente" },
  estados_aceptables: { t: "lista", etq: "los estados aceptables", max: 40, op: ops(C.ESTADOS_CONSERVACION) },
  requisitos_imprescindibles: L("los requisitos imprescindibles", { max: 1000 }),
  preferencias: L("las preferencias", { max: 1000 }),
  plazo_compra: { t: "enum", etq: "el plazo de compra", op: ops(C.PLAZOS_COMPRA), def: "desconocido" },
  financiacion: { t: "enum", etq: "la financiación", op: ops(C.FINANCIACION), def: "no_indicada" },
  financiacion_evidencia: L("la evidencia de la financiación", { max: 500 }),
  estado: { t: "enum", etq: "el estado de la demanda", op: ops(C.ESTADOS_DEMANDA), def: "activa" },
  motivo_cierre: L("el motivo de cierre", { max: 300 }),
};

export const TAREA = {
  titulo: T("el título", { req: true, max: 200, sens: true }),
  tipo: { t: "enum", etq: "el tipo", op: ops(C.TIPOS_TAREA), def: "otro" },
  fecha: { t: "fecha", etq: "la fecha", req: true },
  hora: { t: "hora", etq: "la hora" },
  prioridad: { t: "enum", etq: "la prioridad", op: ops(C.PRIORIDADES), def: "media" },
  responsable: T("el responsable", { max: 80 }),
  estado: { t: "enum", etq: "el estado", op: ops(C.ESTADOS_TAREA), def: "pendiente" },
  notas: L("las notas", { max: 2000 }),
  contacto_id: { t: "fk", etq: "el contacto" },
  oportunidad_id: { t: "fk", etq: "la oportunidad" },
  inmueble_id: { t: "fk", etq: "el inmueble" },
  demanda_id: { t: "fk", etq: "la demanda" },
  aviso_min: { t: "int", etq: "el aviso previo", max: 10080 },
};

export const ACTIVIDAD = {
  tipo: { t: "enum", etq: "el tipo", req: true, op: ops(C.TIPOS_ACTIVIDAD) },
  direccion: { t: "enum", etq: "la dirección", op: ops(C.DIRECCIONES), def: "saliente" },
  fecha: { t: "fecha", etq: "la fecha", req: true },
  hora: { t: "hora", etq: "la hora" },
  resumen: L("el resumen", { req: true, max: 2000 }),
  resultado: T("el resultado", { max: 300, sens: true }),
  contacto_id: { t: "fk", etq: "el contacto" },
  oportunidad_id: { t: "fk", etq: "la oportunidad" },
  inmueble_id: { t: "fk", etq: "el inmueble" },
  demanda_id: { t: "fk", etq: "la demanda" },
};

/** Campos JSON por tabla (se guardan como texto y se devuelven como lista). */
export const CAMPOS_LISTA = {
  inmuebles: ["datos_pendientes"],
  demandas: ["municipios", "tipos", "estados_aceptables"],
};
