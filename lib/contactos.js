// ============================================================================
//  Clientes que Pau adjunta al chat: agenda del móvil (.vcf) e Inmoweb (.csv)
// ----------------------------------------------------------------------------
//  El servidor no puede leer los contactos del teléfono. La vía es que Pau
//  exporte su agenda de Android a un archivo .vcf (o sus clientes de Inmoweb a
//  .csv) y se lo comparta o adjunte a Clara. Aquí se leen esos archivos (sin
//  dependencias) y se convierten en clientes para cruzar_clientes.
//
//  Reglas:
//   · Lo que busca cada contacto sale de su NOTE (vCard) o de sus columnas
//     (CSV): zona, presupuesto, habitaciones, metros, operación. Si no dice
//     nada, cuenta como «sin criterios»: no se inventa.
//   · No se guardan en ningún sitio: el navegador los vuelve a mandar en cada
//     mensaje de la conversación (hasta que se recarga la página) y aquí viven
//     solo en la petición en curso.
//   · Al modelo le llega lo mínimo (nombre de pila con la inicial del
//     apellido, criterios acotados y, si Pau lo pide, el teléfono). Nunca el
//     correo ni la nota entera. Ningún campo libre llega sin acotar.
//   · Codificación: UTF-8 y, si no lo es, Windows-1252 (el CSV que guarda
//     Excel en español), para que «Gijón» no llegue como «Gij�n».
//   · Topes de tamaño: una agenda puede tener cientos o miles de contactos.
//
//  Excel (.xlsx) no se lee: es un ZIP con XML y no hay lector sin
//  dependencias; se le pide a Pau que lo exporte a CSV.
// ============================================================================

import { extraerFicha } from "./oportunidades-extras.js";

export const MAX_CONTACTOS = 2000; // por archivo
export const MAX_TEXTO_ARCHIVO = 3_000_000; // caracteres por archivo

const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Fuera caracteres de control (saltos de línea incluidos) y espacios repetidos.
const limpia = (s) => String(s || "").replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();

export const MAX_ZONAS = 5;
export const MAX_LARGO_ZONA = 40;
export const MAX_ZONA_COLUMNA = 60;

// Bytes → texto. Primero UTF-8 estricto; si no lo es, Windows-1252 (Excel en
// español guarda así los CSV y la agenda 2.1 de algunos móviles, en Latin-1).
export function decodificaTexto(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// Tipos de adjunto de texto que se aceptan, por tipo MIME o por extensión.
export function tipoLista(mediaType, nombre = "") {
  const t = String(mediaType || "").toLowerCase();
  const n = String(nombre || "").toLowerCase();
  if (/^text\/(x-)?vcard$|^text\/directory$/.test(t) || n.endsWith(".vcf") || n.endsWith(".vcard")) return "vcard";
  if (/^text\/csv$|^text\/comma-separated-values$|^application\/csv$/.test(t) || n.endsWith(".csv")) return "csv";
  return null;
}
export const esExcel = (mediaType, nombre = "") =>
  /spreadsheetml|ms-excel/.test(String(mediaType || "")) || /\.xlsx?$/i.test(String(nombre || ""));

// ---------------------------------------------------------------------------
//  vCard (2.1, 3.0 y 4.0): FN, N, TEL, EMAIL y NOTE
// ---------------------------------------------------------------------------
// Quoted-printable (vCard 2.1 de Android: «ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8»).
function decodificaQP(v) {
  const bytes = [];
  const s = String(v).replace(/=\r?\n/g, "");
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "=" && /^[0-9A-F]{2}$/i.test(s.slice(i + 1, i + 3))) {
      bytes.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      for (const b of Buffer.from(s[i], "utf8")) bytes.push(b);
    }
  }
  return decodificaTexto(Buffer.from(bytes));
}
const desescapa = (v) => String(v).replace(/\\n/gi, "\n").replace(/\\([,;:\\])/g, "$1");

export function leerVcard(texto) {
  const bruto = String(texto || "").slice(0, MAX_TEXTO_ARCHIVO).replace(/\r\n/g, "\n");
  // Líneas plegadas: las que empiezan por espacio o tabulador siguen a la anterior;
  // en quoted-printable, una línea que acaba en «=» sigue en la siguiente.
  const lineas = [];
  for (const l of bruto.split("\n")) {
    const previa = lineas.length ? lineas[lineas.length - 1] : null;
    if (previa !== null && /^[ \t]/.test(l)) lineas[lineas.length - 1] = previa + l.slice(1);
    else if (previa !== null && /QUOTED-PRINTABLE/i.test(previa.split(":")[0]) && previa.endsWith("=")) lineas[lineas.length - 1] = previa.slice(0, -1) + l;
    else lineas.push(l);
  }
  const contactos = [];
  let actual = null;
  let recortado = false;
  for (const l of lineas) {
    if (/^BEGIN:VCARD/i.test(l)) { actual = { nombre: "", telefonos: [], emails: [], nota: "" }; continue; }
    if (/^END:VCARD/i.test(l)) {
      if (actual && (actual.nombre || actual.telefonos.length)) {
        if (contactos.length >= MAX_CONTACTOS) { recortado = true; break; }
        contactos.push(actual);
      }
      actual = null;
      continue;
    }
    if (!actual) continue;
    const dos = l.indexOf(":");
    if (dos < 0) continue;
    const cabeza = l.slice(0, dos);
    let valor = l.slice(dos + 1);
    const [propiedad, ...params] = cabeza.split(";");
    const prop = propiedad.replace(/^item\d+\./i, "").toUpperCase();
    if (params.some((p) => /QUOTED-PRINTABLE/i.test(p))) valor = decodificaQP(valor);
    valor = desescapa(valor).trim();
    if (!valor) continue;
    if (prop === "FN") actual.nombre = limpia(valor).slice(0, 80);
    else if (prop === "N" && !actual.nombre) actual.nombre = limpia(valor.split(";").filter(Boolean).reverse().join(" ")).slice(0, 80);
    else if (prop === "TEL") { const tel = telefono(valor); if (tel) actual.telefonos.push(tel); }
    else if (prop === "EMAIL") actual.emails.push(valor.slice(0, 120));
    else if (prop === "NOTE") actual.nota = (actual.nota ? actual.nota + "\n" : "") + valor.slice(0, 1000);
  }
  return { contactos, recortado };
}

// Teléfono: solo cifras, «+», espacios, guiones y paréntesis (nada de texto libre).
function telefono(v) {
  return String(v || "").replace(/^tel:/i, "").replace(/[^\d+ ()-]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);
}

// ---------------------------------------------------------------------------
//  CSV (separador «;» o «,», cabecera en la primera fila, comillas dobles)
// ---------------------------------------------------------------------------
export function separadorCsv(primeraLinea) {
  const l = String(primeraLinea || "");
  const cuenta = (c) => l.split(c).length - 1;
  return cuenta(";") >= cuenta(",") && cuenta(";") > 0 ? ";" : cuenta("\t") > cuenta(",") ? "\t" : ",";
}

// info.comillaSinCerrar = true si el archivo acaba con unas comillas abiertas
// (entonces todo lo que sigue se ha leído como un único campo).
export function filasCsv(texto, sep, info = {}) {
  const s = String(texto || "").slice(0, MAX_TEXTO_ARCHIVO).replace(/^﻿/, "");
  const filas = [];
  let fila = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comillas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"' && campo === "") comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      fila.push(campo);
      if (fila.some((x) => x.trim() !== "")) filas.push(fila);
      fila = [];
      campo = "";
      if (filas.length > MAX_CONTACTOS + 1) break;
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== "")) filas.push(fila);
  info.comillaSinCerrar = comillas;
  return filas;
}

// Operación de la columna «Operación» → texto para el extractor. En una
// demanda de Inmoweb, «Venta» (o «Compraventa») quiere decir que el cliente
// compra; «Alquiler», que alquila.
function operacionDeColumna(v) {
  const t = sinTildes(v);
  if (!t) return "";
  if (/alquil|arrend|renta\b|inquilin/.test(t)) return "alquilar";
  if (/venta|compr|invers/.test(t)) return "comprar";
  return limpia(v).slice(0, 40);
}

// Qué columna es cada cosa (nombres habituales; los de Inmoweb no se han podido verificar).
const COLUMNAS = {
  nombre: /^(nombre( completo| y apellidos)?|name|full name|cliente|contacto|razon social)$/,
  apellidos: /^(apellidos?|last name|surname)$/,
  telefono: /^(telefono|tel|movil|celular|phone|mobile|telefono movil|telefono 1|movil 1)$/,
  email: /^(e-?mail|correo|correo electronico)$/,
  operacion: /^(operacion|tipo de operacion|tipo operacion|busca|demanda|interes)$/,
  presupuesto: /^(presupuesto|presupuesto maximo|precio maximo|precio max|importe maximo|hasta|precio)$/,
  zona: /^(zonas?|localidad|poblacion|municipio|ciudad|barrio|zona de interes)$/,
  habitaciones: /^(habitaciones|habitaciones minimas|hab|dormitorios)$/,
  metros: /^(metros|m2|superficie|superficie minima|metros minimos)$/,
  notas: /^(notas?|observaciones|comentarios?|descripcion|que busca)$/,
};

// ¿Parece mal formado? Comillas sin cerrar, o todo metido en una sola fila con
// muchísimos campos o con un campo larguísimo.
function pareceMalFormado(filas, info) {
  if (info.comillaSinCerrar) return true;
  if (filas.length > 2) return false;
  const columnas = filas[0]?.length || 0;
  return filas.some((f) => f.length > Math.max(columnas, 1) + 10 || f.length > 60 || f.some((c) => c.length > 1000));
}

export function leerCsv(texto) {
  const s = String(texto || "");
  const sep = separadorCsv(s.split(/\r?\n/, 1)[0]);
  const info = {};
  const filas = filasCsv(s, sep, info);
  const malFormado = pareceMalFormado(filas, info);
  if (filas.length < 2) return { contactos: [], recortado: false, columnas: [], malFormado };
  const cabecera = filas[0].map((c) => sinTildes(c).trim().replace(/\s+/g, " "));
  const indice = {};
  for (const [clave, re] of Object.entries(COLUMNAS)) {
    const i = cabecera.findIndex((c) => re.test(c));
    if (i >= 0) indice[clave] = i;
  }
  const v = (f, clave) => (indice[clave] === undefined ? "" : String(f[indice[clave]] ?? "").trim());
  const datos = filas.slice(1);
  const contactos = datos.slice(0, MAX_CONTACTOS).map((f) => {
    const nombre = limpia([v(f, "nombre"), v(f, "apellidos")].filter(Boolean).join(" ")).slice(0, 80);
    // Lo que busca: columnas propias y, si no, las notas, todo como texto para el mismo extractor.
    const partes = [
      v(f, "operacion") && `quiere ${operacionDeColumna(v(f, "operacion"))}`,
      v(f, "zona") && `en ${v(f, "zona")}`,
      v(f, "presupuesto") && `hasta ${v(f, "presupuesto").replace(/,\d{1,2}(?=\s*(€|eur|$))/i, "")}${/€|eur/i.test(v(f, "presupuesto")) ? "" : " €"}`,
      v(f, "habitaciones") && `${v(f, "habitaciones")} habitaciones`,
      v(f, "metros") && `${v(f, "metros")} m2`,
      v(f, "notas"),
    ].filter(Boolean);
    return {
      nombre,
      telefonos: telefono(v(f, "telefono")) ? [telefono(v(f, "telefono"))] : [],
      emails: v(f, "email") ? [v(f, "email").slice(0, 120)] : [],
      nota: partes.join(". ").slice(0, 1000),
      // Acotada: es texto libre del archivo y acaba en las zonas que ve el modelo.
      zonaColumna: limpia(v(f, "zona")).slice(0, MAX_ZONA_COLUMNA),
    };
  }).filter((c) => c.nombre || c.telefonos.length);
  return { contactos, recortado: datos.length > MAX_CONTACTOS, columnas: Object.keys(indice), malFormado };
}

// ---------------------------------------------------------------------------
//  Lo que busca: del texto libre a criterios (mismo extractor que la alta
//  rápida de Oportunidades). Sin palabras de búsqueda → null.
// ---------------------------------------------------------------------------
export function criteriosDeTexto(texto, zonaExtra = "") {
  const t = sinTildes(texto);
  if (!t.trim()) return null;
  const f = extraerFicha(texto);
  const operacion = /alquil|arrend|inquilin|renta\b/.test(t) ? "alquiler" : /compr|adquir|invert|inversion/.test(t) ? "venta" : null;
  // La zona de la columna puede traer varias («Gijón, Avilés» o «Oviedo / Siero»).
  const extra = limpia(String(zonaExtra || "").slice(0, MAX_ZONA_COLUMNA)).split(/[,/]/);
  const zonas = [...new Set([f.ciudad, f.zona, ...extra].map((z) => limpia(z).slice(0, MAX_LARGO_ZONA)).filter(Boolean))].slice(0, MAX_ZONAS);
  const c = {
    operacion,
    presupuesto_max: Number(f.precio) > 0 ? Number(f.precio) : null,
    zonas,
    habitaciones_min: Number(f.habitaciones) > 0 ? Number(f.habitaciones) : null,
    metros_min: Number(f.metros) > 0 ? Number(f.metros) : null,
    necesita: Array.isArray(f.caracteristicas) ? f.caracteristicas : [],
  };
  const alguno = c.operacion || c.presupuesto_max || c.zonas.length || c.habitaciones_min || c.metros_min;
  return alguno ? c : null;
}

// Nombre que ve el modelo: el de pila y la inicial del apellido («Marcos D.»).
// Solo letras, cifras, espacios, puntos, guiones y apóstrofos.
export function aliasContacto(nombre) {
  const p = limpia(String(nombre || "").replace(/[^\p{L}\p{N} .'-]/gu, " ")).split(" ").filter((x) => /[\p{L}\p{N}]/u.test(x));
  if (!p.length) return "Contacto sin nombre";
  const inicial = p[1] ? ` ${p[1].match(/[\p{L}\p{N}]/u)[0].toUpperCase()}.` : "";
  return p[0].slice(0, 30) + inicial;
}

// Contacto → cliente para el cruce (con criterios o marcado «sin criterios»).
export function clienteDeContacto(contacto, fuente, conTelefono = false) {
  const criterios = criteriosDeTexto(contacto.nota, contacto.zonaColumna);
  const r = {
    fuente,
    alias: aliasContacto(contacto.nombre),
    operacion: criterios?.operacion ?? null,
    presupuesto_max: criterios?.presupuesto_max ?? null,
    zonas: criterios?.zonas ?? [],
    habitaciones_min: criterios?.habitaciones_min ?? null,
    metros_min: criterios?.metros_min ?? null,
    necesita: criterios?.necesita ?? [],
    sinCriterios: !criterios,
  };
  if (conTelefono && contacto.telefonos?.[0]) r.telefono = contacto.telefonos[0];
  return r;
}

// Un adjunto (base64) → { ok, tipo, nombre, contactos, recortado } o { ok:false, error }.
export function leerListaAdjunta(adjunto) {
  const tipo = tipoLista(adjunto?.media_type, adjunto?.nombre);
  const nombre = limpia(String(adjunto?.nombre || "").replace(/[«»<>`]/g, "")).slice(0, 60) || (tipo === "csv" ? "clientes.csv" : "contactos.vcf");
  if (!tipo) return { ok: false, error: "no es un .vcf ni un .csv" };
  let texto;
  try {
    texto = decodificaTexto(Buffer.from(String(adjunto.data || ""), "base64"));
  } catch {
    return { ok: false, error: "no se pudo leer el archivo" };
  }
  const r = tipo === "vcard" ? leerVcard(texto) : leerCsv(texto);
  return { ok: true, tipo, nombre, ...r };
}

// Línea que ve Clara en el mensaje (sin datos personales: solo recuentos).
export function avisoListaAdjunta(lista, conCriterios) {
  if (!lista.ok) return `[📇 Archivo «${lista.nombre || "adjunto"}» NO leído: ${lista.error}.]`;
  const que = lista.tipo === "vcard" ? "Agenda del móvil" : "Lista de clientes (CSV)";
  const sin = lista.contactos.length - conCriterios;
  return (
    `[📇 ${que} «${lista.nombre}» adjunta: ${lista.contactos.length} contacto(s) leídos, ${conCriterios} con criterios de búsqueda y ${sin} sin criterios` +
    (lista.recortado ? ` (solo se han leído los primeros ${MAX_CONTACTOS})` : "") +
    (lista.tipo === "csv" && !lista.columnas?.length ? "; no reconozco las columnas de la cabecera" : "") +
    (lista.malFormado ? "; el archivo parece mal formado (unas comillas sin cerrar o todo en una sola fila): dile a Pau que lo exporte otra vez como CSV" : "") +
    `. No te paso los datos aquí: usa cruzar_clientes para cruzarlos con la cartera. Valen para esta conversación mientras Pau no recargue la página (el navegador los vuelve a mandar en cada mensaje; si recarga o empieza otra, hay que adjuntarlos de nuevo) y no se guardan en ningún sitio.]`
  );
}
