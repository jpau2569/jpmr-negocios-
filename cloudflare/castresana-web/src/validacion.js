// ============================================================================
//  Validación de lo que llega de los formularios — lógica pura
// ----------------------------------------------------------------------------
//  El navegador ayuda (required, maxlength…), pero quien manda es el servidor:
//  todo se limpia, se acota y se comprueba aquí antes de tocar la base de datos.
// ============================================================================

export const VERSION_PRIVACIDAD = "borrador-2026-10";

export const OPERACIONES = [
  { id: "vender", texto: "Vender" },
  { id: "alquilar", texto: "Alquilar" },
];
export const TIPOS = [
  { id: "piso", texto: "Piso" },
  { id: "atico", texto: "Ático" },
  { id: "duplex", texto: "Dúplex" },
  { id: "bajo", texto: "Bajo" },
  { id: "estudio", texto: "Estudio" },
  { id: "casa", texto: "Casa o chalet" },
  { id: "local", texto: "Local" },
  { id: "oficina", texto: "Oficina" },
  { id: "garaje", texto: "Plaza de garaje" },
  { id: "trastero", texto: "Trastero" },
  { id: "terreno", texto: "Terreno o finca" },
  { id: "otro", texto: "Otro" },
];
export const textoDe = (lista, id) => lista.find((x) => x.id === id)?.texto || id;

export const LIMITES = {
  nombre: 80, telefono: 20, correo: 120, zona: 160, comentario: 1000,
  referencia: 40, titulo: 120, zonaInmueble: 80, enlace: 300, motivo: 120,
};

// Quita caracteres de control (deja saltos de línea solo si se piden),
// normaliza a NFC y recorta espacios.
export function limpia(valor, { max = 200, lineas = false } = {}) {
  let t = String(valor ?? "").normalize("NFC");
  t = lineas
    ? t.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "").replace(/\n{3,}/g, "\n\n")
    : t.replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ");
  t = t.trim();
  return { texto: t, largo: [...t].length, sobra: [...t].length > max };
}

/**
 * Teléfono español → 9 cifras ('600111222') o null.
 * Acepta espacios, puntos, guiones, paréntesis y el prefijo +34 / 0034 / 34.
 * Válidos: móviles (6, 7) y fijos (8, 9), que es lo que asigna el plan español.
 */
export function telefonoEspanol(valor) {
  let t = String(valor ?? "").replace(/[\s.\-()/]/g, "");
  if (t.startsWith("+34")) t = t.slice(3);
  else if (t.startsWith("0034")) t = t.slice(4);
  else if (/^34\d{9}$/.test(t)) t = t.slice(2);
  return /^[6789]\d{8}$/.test(t) ? t : null;
}
export const esMovil = (tel) => /^[67]\d{8}$/.test(String(tel || ""));
export const telefonoBonito = (tel) => String(tel || "").replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");

export function correoValido(valor) {
  const t = String(valor ?? "").trim();
  return t.length <= LIMITES.correo && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(t);
}

/** Entero opcional dentro de [min, max]. '' → null; inválido → NaN. */
function enteroOpcional(valor, min, max) {
  const t = String(valor ?? "").trim().replace(/\s/g, "");
  if (t === "") return null;
  if (!/^\d{1,6}$/.test(t)) return NaN;
  const n = Number(t);
  return n >= min && n <= max ? n : NaN;
}

const aceptado = (v) => ["on", "1", "true", "si", "sí"].includes(String(v ?? "").toLowerCase());

function textoObligatorio(datos, campo, errores, { min = 2, max, etiqueta, lineas = false }) {
  const { texto, largo, sobra } = limpia(datos[campo], { max, lineas });
  if (largo < min) errores[campo] = `Escribe ${etiqueta}.`;
  else if (sobra) errores[campo] = `${etiqueta[0].toUpperCase() + etiqueta.slice(1)}: como mucho ${max} caracteres.`;
  return texto;
}
function textoOpcional(datos, campo, errores, { max, etiqueta, lineas = false }) {
  const { texto, sobra } = limpia(datos[campo], { max, lineas });
  if (sobra) errores[campo] = `${etiqueta}: como mucho ${max} caracteres.`;
  return texto;
}

/** Formulario «Valora tu piso». datos: objeto con los campos del formulario. */
export function validaValoracion(datos = {}) {
  const errores = {};
  const nombre = textoObligatorio(datos, "nombre", errores, { max: LIMITES.nombre, etiqueta: "tu nombre" });
  const telefono = telefonoEspanol(datos.telefono);
  if (!telefono) errores.telefono = "Escribe un teléfono español de 9 cifras (por ejemplo, 600 11 22 33).";
  const correoTexto = limpia(datos.correo, { max: LIMITES.correo }).texto;
  if (correoTexto && !correoValido(correoTexto)) errores.correo = "El correo no parece válido (o déjalo en blanco, es opcional).";
  const operacion = String(datos.operacion ?? "");
  if (!OPERACIONES.some((o) => o.id === operacion)) errores.operacion = "Elige si quieres vender o alquilar.";
  const tipo = String(datos.tipo ?? "");
  if (!TIPOS.some((t) => t.id === tipo)) errores.tipo = "Elige el tipo de inmueble.";
  const zona = textoObligatorio(datos, "zona", errores, { min: 3, max: LIMITES.zona, etiqueta: "la zona o dirección aproximada" });
  const metros = enteroOpcional(datos.metros, 5, 100000);
  if (Number.isNaN(metros)) errores.metros = "Los metros, en número entero (por ejemplo, 85), o déjalo en blanco.";
  const habitaciones = enteroOpcional(datos.habitaciones, 0, 50);
  if (Number.isNaN(habitaciones)) errores.habitaciones = "Las habitaciones, en número (0 a 50), o déjalo en blanco.";
  const comentario = textoOpcional(datos, "comentario", errores, { max: LIMITES.comentario, etiqueta: "El comentario", lineas: true });
  if (!aceptado(datos.privacidad)) errores.privacidad = "Para enviarlo tienes que aceptar la información de privacidad.";
  const ok = Object.keys(errores).length === 0;
  return {
    ok, errores,
    valor: ok ? { nombre, telefono, correo: correoTexto, operacion, tipo, zona, metros, habitaciones, comentario, privacidad: VERSION_PRIVACIDAD } : null,
  };
}

/** Reserva de visita (sin el hueco, que lo comprueba horario.js). */
export function validaReserva(datos = {}) {
  const errores = {};
  const referencia = limpia(datos.referencia, { max: LIMITES.referencia }).texto;
  if (!esReferencia(referencia)) errores.referencia = "Elige el inmueble que quieres visitar.";
  const fechaHora = String(datos.fecha_hora ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fechaHora)) errores.fecha_hora = "Elige una hora libre.";
  const nombre = textoObligatorio(datos, "nombre", errores, { max: LIMITES.nombre, etiqueta: "tu nombre" });
  const telefono = telefonoEspanol(datos.telefono);
  if (!telefono) errores.telefono = "Escribe un teléfono español de 9 cifras (por ejemplo, 600 11 22 33).";
  const comentario = textoOpcional(datos, "comentario", errores, { max: 500, etiqueta: "El comentario", lineas: true });
  if (!aceptado(datos.privacidad)) errores.privacidad = "Para reservar tienes que aceptar la información de privacidad.";
  const ok = Object.keys(errores).length === 0;
  return { ok, errores, valor: ok ? { referencia, fechaHora, nombre, telefono, comentario } : null };
}

// ---- Inmuebles (panel) -----------------------------------------------------
/** Referencia: letras (con tildes), números, espacios y - / . º ª, de 2 a 40. */
export function esReferencia(texto) {
  const t = String(texto ?? "");
  return t.length >= 2 && t.length <= LIMITES.referencia && /^[\p{L}\p{N}][\p{L}\p{N} \-/.ºª,]*$/u.test(t);
}

/** Enlace opcional: solo https, sin usuario ni contraseña. */
export function enlaceSeguro(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return "";
  if (t.length > LIMITES.enlace) return null;
  try {
    const u = new URL(t);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}

export function validaInmueble(datos = {}) {
  const errores = [];
  const referencia = limpia(datos.referencia, { max: LIMITES.referencia }).texto;
  if (!esReferencia(referencia)) errores.push(`Referencia «${referencia || "(vacía)"}» no válida: de 2 a 40 letras o números.`);
  const titulo = limpia(datos.titulo, { max: LIMITES.titulo });
  if (titulo.sobra) errores.push(`${referencia}: el título pasa de ${LIMITES.titulo} caracteres.`);
  const zona = limpia(datos.zona, { max: LIMITES.zonaInmueble });
  if (zona.sobra) errores.push(`${referencia}: la zona pasa de ${LIMITES.zonaInmueble} caracteres.`);
  const enlace = enlaceSeguro(datos.enlace);
  if (enlace === null) errores.push(`${referencia}: el enlace tiene que empezar por https://`);
  return { ok: errores.length === 0, errores, valor: { referencia, titulo: titulo.texto, zona: zona.texto, enlace: enlace || "" } };
}

/**
 * Lista de inmuebles pegada en el panel. Vale cualquiera de dos formatos:
 *  · JSON: [{"referencia":"PIS0190","titulo":"Piso en Uría","zona":"Centro","enlace":"https://…"}]
 *  · Una línea por inmueble: «PIS0190; Piso en Uría; Centro; https://…» (solo la referencia es obligatoria).
 * Devuelve { ok, lista, errores }. Hasta 500 inmuebles.
 */
export function leeListaInmuebles(texto) {
  const t = String(texto ?? "").trim();
  if (!t) return { ok: false, lista: [], errores: ["La lista está vacía."] };
  let filas;
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const j = JSON.parse(t);
      filas = Array.isArray(j) ? j : [j];
    } catch (e) {
      return { ok: false, lista: [], errores: [`El JSON no es válido: ${String(e.message).slice(0, 120)}`] };
    }
    if (!filas.every((f) => f && typeof f === "object" && !Array.isArray(f))) {
      return { ok: false, lista: [], errores: ["El JSON tiene que ser una lista de objetos con «referencia»."] };
    }
  } else {
    filas = t.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
      const [referencia = "", titulo = "", zona = "", enlace = ""] = l.split(";").map((x) => x.trim());
      return { referencia, titulo, zona, enlace };
    });
  }
  if (filas.length > 500) return { ok: false, lista: [], errores: ["Como mucho 500 inmuebles de una vez."] };
  const errores = [];
  const lista = [];
  const vistas = new Set();
  for (const f of filas) {
    const r = validaInmueble(f);
    if (!r.ok) { errores.push(...r.errores); continue; }
    const clave = r.valor.referencia.toLowerCase();
    if (vistas.has(clave)) { errores.push(`La referencia ${r.valor.referencia} está repetida.`); continue; }
    vistas.add(clave);
    lista.push(r.valor);
  }
  return { ok: errores.length === 0 && lista.length > 0, lista, errores };
}

/** Bloqueo del panel: fecha obligatoria, hora opcional ('' = día entero). */
export function validaBloqueo(datos = {}, esFecha, esHora) {
  const errores = [];
  const fecha = String(datos.fecha ?? "").trim();
  const hora = String(datos.hora ?? "").trim();
  if (!esFecha(fecha)) errores.push("Pon una fecha válida.");
  if (hora && !esHora(hora)) errores.push("La hora tiene que ser HH:MM (o déjala vacía para bloquear el día entero).");
  const motivo = limpia(datos.motivo, { max: LIMITES.motivo });
  if (motivo.sobra) errores.push(`El motivo: como mucho ${LIMITES.motivo} caracteres.`);
  return { ok: errores.length === 0, errores, valor: { fecha, hora, motivo: motivo.texto } };
}
