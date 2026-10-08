// ============================================================================
//  Copias de seguridad COMPLETAS (base de datos + carpeta de archivos) en un
//  único ZIP que se puede abrir con cualquier programa. Dentro:
//    manifiesto.json   qué trae (fecha, esquema, recuentos) y el SHA-256 de cada archivo
//    captao.sqlite     instantánea coherente de la base (VACUUM INTO)
//    archivos/...      adjuntos y fotos (Fase 2)
//  Reglas:
//   - La copia se escribe como «.parcial» y solo se renombra cuando está
//     completa y verificada: nunca queda un ZIP a medias que parezca válido.
//   - Restaurar valida TODO antes de tocar nada, hace antes una copia de lo
//     actual y puede deshacerse si algo falla a mitad.
//   - Una copia guardada en el mismo disco no protege de un fallo del disco:
//     el panel avisa para que se guarde también fuera (pendrive, nube).
// ============================================================================
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { EscritorZip, leerZip, extraerEntrada, nombreSeguro } from "./zip.mjs";
import { abrirBd } from "./bd.mjs";
import { ErrorApp, noEncontrado, conflicto, diasEntre, isoLocal } from "./util.mjs";
import { MIGRACIONES } from "./migraciones.mjs";

const dos = (n) => String(n).padStart(2, "0");
const marca = (d) => `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
const ESQUEMA_ACTUAL = MIGRACIONES[MIGRACIONES.length - 1].version;
const PREFIJOS = ["copia", "auto", "antes-de-restaurar", "subida"];
const NOMBRE_COPIA = /^(copia|auto|antes-de-restaurar|subida)-\d{8}-\d{6}(-\d+)?\.zip$/;
export const MAX_SUBIDA = 2 * 1024 * 1024 * 1024; // 2 GB

async function hashArchivo(ruta) {
  const h = crypto.createHash("sha256");
  for await (const t of fs.createReadStream(ruta)) h.update(t);
  return h.digest("hex");
}

async function listarArchivos(raiz, rel = "") {
  const salida = [];
  let ents = [];
  try { ents = await fsp.readdir(path.join(raiz, rel), { withFileTypes: true }); } catch { return salida; }
  for (const e of ents) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isSymbolicLink()) continue; // nunca se siguen enlaces simbólicos
    if (e.isDirectory()) salida.push(...await listarArchivos(raiz, r));
    else if (e.isFile()) salida.push(r);
  }
  return salida;
}

/** La fecha de una copia es la de su nombre (copia-AAAAMMDD-HHMMSS): no cambia si se copia o se mueve el fichero. */
function fechaDeNombre(nombre, respaldo) {
  const m = /-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(nombre);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString() : respaldo;
}

export function listarCopias(app) {
  let ficheros = [];
  try { ficheros = fs.readdirSync(app.dirs.copias); } catch { /* aún no hay carpeta */ }
  return ficheros.filter((f) => NOMBRE_COPIA.test(f)).map((f) => {
    const st = fs.statSync(path.join(app.dirs.copias, f));
    return { nombre: f, bytes: st.size, modificada: fechaDeNombre(f, st.mtime.toISOString()), tipo: f.split("-")[0] === "antes" ? "antes-de-restaurar" : f.split("-")[0] };
  }).sort((a, b) => b.modificada.localeCompare(a.modificada) || b.nombre.localeCompare(a.nombre));
}

export function rutaCopia(app, nombre) {
  if (!NOMBRE_COPIA.test(String(nombre))) throw noEncontrado("La copia de seguridad");
  const ruta = path.join(app.dirs.copias, nombre);
  if (!fs.existsSync(ruta)) throw noEncontrado("La copia de seguridad");
  return ruta;
}

function recuentos(bd) {
  const n = (t) => Number(bd.valor(`SELECT COUNT(*) FROM ${t}`));
  return { contactos: n("contactos"), oportunidades: n("oportunidades"), inmuebles: n("inmuebles"), demandas: n("demandas"), tareas: n("tareas"), actividades: n("actividades") };
}

export async function crearCopia(app, { tipo = "copia" } = {}) {
  if (!PREFIJOS.includes(tipo)) throw new ErrorApp(500, "copia_tipo", "Tipo de copia desconocido.");
  if (app.mantenimiento) throw conflicto("mantenimiento", "Hay otra operación de copia en curso. Espera unos segundos.");
  app.mantenimiento = "copia";
  const ahora = app.reloj.ahora();
  const bd = app.bd("real");
  await fsp.mkdir(app.dirs.copias, { recursive: true });
  const tmp = path.join(app.dirs.copias, `.tmp-${marca(ahora)}-${process.pid}`);
  try {
    await fsp.mkdir(tmp, { recursive: true });
    const instantanea = path.join(tmp, "captao.sqlite");
    bd.copiarA(instantanea);
    const archivos = await listarArchivos(app.dirs.archivos);
    const contenido = [{ ruta: "captao.sqlite", bytes: (await fsp.stat(instantanea)).size, sha256: await hashArchivo(instantanea) }];
    for (const r of archivos) {
      const abs = path.join(app.dirs.archivos, r);
      contenido.push({ ruta: `archivos/${r}`, bytes: (await fsp.stat(abs)).size, sha256: await hashArchivo(abs) });
    }
    const manifiesto = {
      app: "captaoportunidades", formato: 1, version_app: app.version, esquema: bd.version(), tipo,
      creada_en: ahora.toISOString(), recuentos: recuentos(bd), contenido,
    };
    let nombre = `${tipo}-${marca(ahora)}.zip`;
    for (let i = 2; fs.existsSync(path.join(app.dirs.copias, nombre)); i++) nombre = `${tipo}-${marca(ahora)}-${i}.zip`;
    const parcial = path.join(app.dirs.copias, `${nombre}.parcial`);
    const z = await new EscritorZip(parcial).abrir();
    try {
      await z.anadirBuffer("manifiesto.json", Buffer.from(JSON.stringify(manifiesto, null, 2), "utf8"), ahora);
      await z.anadirArchivo("captao.sqlite", instantanea);
      for (const r of archivos) await z.anadirArchivo(`archivos/${r}`, path.join(app.dirs.archivos, r));
      await z.cerrar();
    } catch (e) { await z.abortar(); throw e; }
    // Verificar lo escrito ANTES de darlo por bueno.
    await inspeccionarCopia(parcial);
    const final = path.join(app.dirs.copias, nombre);
    await fsp.rename(parcial, final);
    const st = await fsp.stat(final);
    return { nombre, bytes: st.size, tipo, creada_en: manifiesto.creada_en, recuentos: manifiesto.recuentos, archivos: archivos.length };
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true });
    for (const f of await fsp.readdir(app.dirs.copias).catch(() => [])) {
      if (f.endsWith(".parcial")) await fsp.rm(path.join(app.dirs.copias, f), { force: true }).catch(() => {});
    }
    app.mantenimiento = null;
  }
}

/** Abre de verdad la base de la copia (solo lectura) y cuenta lo que contiene: el manifiesto lo escribe cada ZIP como quiere. */
async function recuentosDeBase(ruta, entrada) {
  const tmp = path.join(path.dirname(ruta), `.comprobar-${process.pid}-${Date.now()}.sqlite`);
  try {
    await extraerEntrada(ruta, entrada, tmp);
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(tmp, { readOnly: true });
    try {
      if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new ErrorApp(422, "copia_corrupta", "La base de datos de la copia no pasa la comprobación de integridad.");
      const n = (t) => Number(db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n);
      return { contactos: n("contactos"), oportunidades: n("oportunidades"), inmuebles: n("inmuebles"), demandas: n("demandas"), tareas: n("tareas"), actividades: n("actividades") };
    } catch (e) {
      if (e instanceof ErrorApp) throw e;
      throw new ErrorApp(422, "copia_invalida", "La base de datos de la copia no tiene la estructura esperada: no es una copia válida de este programa.");
    } finally { db.close(); }
  } finally { await fsp.rm(tmp, { force: true }).catch(() => {}); }
}

async function leerManifiesto(ruta, entradas) {
  const e = entradas.find((x) => x.nombre === "manifiesto.json");
  if (!e) throw new ErrorApp(422, "copia_sin_manifiesto", "Este ZIP no es una copia de CAPTAOPORTUNIDADES (falta el manifiesto).");
  if (e.usize > 5 * 1024 * 1024) throw new ErrorApp(422, "copia_invalida", "El manifiesto de la copia es sospechosamente grande.");
  const trozos = [];
  await extraerEntrada(ruta, e, new Writable({ write(c, _, cb) { trozos.push(c); cb(); } }));
  try { return JSON.parse(Buffer.concat(trozos).toString("utf8")); } catch { throw new ErrorApp(422, "copia_invalida", "El manifiesto de la copia está dañado."); }
}

/** Valida una copia sin restaurarla. Lanza ErrorApp 422 si algo no cuadra. */
export async function inspeccionarCopia(ruta) {
  const { entradas } = await leerZip(ruta);
  const m = await leerManifiesto(ruta, entradas);
  if (m?.app !== "captaoportunidades" || m.formato !== 1 || !Array.isArray(m.contenido)) {
    throw new ErrorApp(422, "copia_invalida", "Este ZIP no es una copia de CAPTAOPORTUNIDADES o es de un formato que no conozco.");
  }
  if (!Number.isInteger(m.esquema) || m.esquema > ESQUEMA_ACTUAL) {
    throw new ErrorApp(422, "copia_mas_nueva", `Esta copia es de una versión más nueva del programa (esquema ${m.esquema}; este llega al ${ESQUEMA_ACTUAL}). Actualiza el programa antes de restaurarla.`);
  }
  const esperadas = new Map(m.contenido.map((c) => [c.ruta, c]));
  if (esperadas.size !== m.contenido.length) throw new ErrorApp(422, "copia_invalida", "El manifiesto repite archivos.");
  if (!esperadas.has("captao.sqlite")) throw new ErrorApp(422, "copia_invalida", "La copia no contiene la base de datos.");
  const reales = entradas.filter((e) => e.nombre !== "manifiesto.json");
  if (reales.length !== esperadas.size) throw new ErrorApp(422, "copia_invalida", "El contenido del ZIP no coincide con su manifiesto.");
  let bytes = 0;
  if (reales.reduce((a, e) => a + e.usize, 0) > 4 * 1024 ** 3) throw new ErrorApp(422, "copia_enorme", "La copia se expande a más de 4 GB: se rechaza por seguridad.");
  let recuentosReales = null;
  for (const e of reales) {
    const c = esperadas.get(e.nombre);
    const permitido = e.nombre === "captao.sqlite" || (e.nombre.startsWith("archivos/") && nombreSeguro(e.nombre));
    if (!c || !permitido) throw new ErrorApp(422, "copia_invalida", `La copia contiene un archivo no permitido: ${e.nombre}`);
    const r = await extraerEntrada(ruta, e, null, { crypto });
    if (r.sha256 !== c.sha256 || r.bytes !== c.bytes) throw new ErrorApp(422, "copia_corrupta", `La copia está dañada: «${e.nombre}» no coincide con lo que se guardó.`);
    bytes += r.bytes;
    if (e.nombre === "captao.sqlite") recuentosReales = await recuentosDeBase(ruta, e);
  }
  return {
    valida: true,
    creada_en: m.creada_en, tipo: m.tipo, esquema: m.esquema, version_app: m.version_app,
    recuentos: recuentosReales, vacia: Object.values(recuentosReales).every((n) => n === 0), archivos: reales.length - 1, bytes_contenido: bytes,
    entradas: reales,
  };
}

export async function inspeccionarPorNombre(app, nombre) {
  const r = await inspeccionarCopia(rutaCopia(app, nombre));
  delete r.entradas;
  return { nombre, ...r };
}

/** Guarda un ZIP subido desde el navegador (en streaming, con tope de tamaño) y lo valida. */
export async function guardarSubida(app, flujo, { tamanoDeclarado = 0 } = {}) {
  if (tamanoDeclarado > MAX_SUBIDA) throw new ErrorApp(413, "subida_grande", "El archivo es demasiado grande (máximo 2 GB).");
  await fsp.mkdir(app.dirs.copias, { recursive: true });
  const ahora = app.reloj.ahora();
  let nombre = `subida-${marca(ahora)}.zip`;
  for (let i = 2; fs.existsSync(path.join(app.dirs.copias, nombre)); i++) nombre = `subida-${marca(ahora)}-${i}.zip`;
  const parcial = path.join(app.dirs.copias, `${nombre}.parcial`);
  let recibidos = 0;
  try {
    await pipeline(flujo, async function* (fuente) { for await (const c of fuente) { recibidos += c.length; if (recibidos > MAX_SUBIDA) throw new ErrorApp(413, "subida_grande", "El archivo es demasiado grande (máximo 2 GB)."); yield c; } }, fs.createWriteStream(parcial));
    const resumen = await inspeccionarCopia(parcial); // si no es válida, lanza y se borra abajo
    await fsp.rename(parcial, path.join(app.dirs.copias, nombre));
    delete resumen.entradas;
    return { nombre, ...resumen };
  } catch (e) {
    await fsp.rm(parcial, { force: true }).catch(() => {});
    if (e instanceof ErrorApp) throw e;
    throw new ErrorApp(422, "subida_fallida", "No se pudo recibir el archivo completo. Inténtalo de nuevo.");
  }
}

export async function eliminarCopia(app, nombre) {
  const ruta = rutaCopia(app, nombre);
  await fsp.rm(ruta, { force: true });
  return { eliminada: true };
}

/** Restaura una copia. Valida primero, guarda lo actual y puede revertir. */
export async function restaurarCopia(app, nombre) {
  const ruta = rutaCopia(app, nombre);
  const insp = await inspeccionarCopia(ruta);
  if (app.mantenimiento) throw conflicto("mantenimiento", "Hay otra operación de copia en curso. Espera unos segundos.");
  const ahora = app.reloj.ahora();
  const stage = path.join(app.dirs.datos, `.restaurar-${marca(ahora)}-${process.pid}`);
  await fsp.mkdir(stage, { recursive: true });
  try {
    // 1. Extraer a un área temporal (mismo disco, para poder renombrar de forma atómica)
    for (const e of insp.entradas) {
      const dest = path.join(stage, e.nombre === "captao.sqlite" ? "captao.sqlite" : e.nombre);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await extraerEntrada(ruta, e, dest);
    }
    // 2. Comprobar que la base restaurada se abre, está sana y (si es antigua) se actualiza
    const bdTmp = abrirBd(path.join(stage, "captao.sqlite"));
    const integridad = bdTmp.valor("PRAGMA integrity_check");
    const contados = recuentos(bdTmp);
    bdTmp.cerrar();
    if (integridad !== "ok") throw new ErrorApp(422, "copia_corrupta", "La base de datos de la copia no pasa la comprobación de integridad.");

    // 3. Copia de seguridad de lo que hay ahora (por si te arrepientes)
    const previa = await crearCopia(app, { tipo: "antes-de-restaurar" });

    // 4. Intercambio con marcha atrás
    app.mantenimiento = "restaurando";
    const viejaBd = `${app.dirs.bdReal}.reemplazada`;
    const viejosArchivos = `${app.dirs.archivos}.reemplazados`;
    try {
      app.cerrarReal();
      await fsp.rm(viejaBd, { force: true });
      await fsp.rm(viejosArchivos, { recursive: true, force: true });
      if (fs.existsSync(app.dirs.bdReal)) await fsp.rename(app.dirs.bdReal, viejaBd);
      for (const ext of ["-wal", "-shm"]) await fsp.rm(app.dirs.bdReal + ext, { force: true });
      if (fs.existsSync(app.dirs.archivos)) await fsp.rename(app.dirs.archivos, viejosArchivos);
      await fsp.rename(path.join(stage, "captao.sqlite"), app.dirs.bdReal);
      if (fs.existsSync(path.join(stage, "archivos"))) await fsp.rename(path.join(stage, "archivos"), app.dirs.archivos);
      else await fsp.mkdir(app.dirs.archivos, { recursive: true });
      app.reabrirReal();
    } catch (e) {
      // Marcha atrás: dejar todo como estaba.
      try { app.cerrarReal(); } catch { /* ya cerrada */ }
      await fsp.rm(app.dirs.bdReal, { force: true }).catch(() => {});
      if (fs.existsSync(viejaBd)) await fsp.rename(viejaBd, app.dirs.bdReal).catch(() => {});
      await fsp.rm(app.dirs.archivos, { recursive: true, force: true }).catch(() => {});
      if (fs.existsSync(viejosArchivos)) await fsp.rename(viejosArchivos, app.dirs.archivos).catch(() => {});
      try { app.reabrirReal(); } catch { /* se informará abajo */ }
      throw new ErrorApp(500, "restauracion_fallida", `No se pudo restaurar y se ha dejado todo como estaba. Detalle: ${e.message}`);
    } finally { app.mantenimiento = null; }
    await fsp.rm(viejaBd, { force: true });
    await fsp.rm(viejosArchivos, { recursive: true, force: true });
    return { restaurada: nombre, copia_previa: previa.nombre, recuentos: contados, creada_en: insp.creada_en };
  } finally {
    await fsp.rm(stage, { recursive: true, force: true }).catch(() => {});
  }
}

/** Copia automática diaria (si está activada y hay datos) con rotación. */
export async function copiaAutomaticaSiToca(app) {
  const bd = app.bd("real");
  const cfg = app.ctx("real").config().copias;
  if (!cfg.automaticas) return null;
  const r = recuentos(bd);
  if (Object.values(r).every((n) => n === 0)) return null;
  const ultima = listarCopias(app).find((c) => c.tipo === "copia" || c.tipo === "auto");
  if (ultima && app.reloj.ahora() - new Date(ultima.modificada) < 20 * 3600 * 1000) return null;
  const hecha = await crearCopia(app, { tipo: "auto" });
  const autos = listarCopias(app).filter((c) => c.tipo === "auto");
  for (const vieja of autos.slice(cfg.conservar)) await fsp.rm(path.join(app.dirs.copias, vieja.nombre), { force: true });
  for (const tipo of ["subida", "antes-de-restaurar"]) { // no se acumulan sin límite
    for (const vieja of listarCopias(app).filter((c) => c.tipo === tipo).slice(5)) await fsp.rm(path.join(app.dirs.copias, vieja.nombre), { force: true });
  }
  return hecha;
}

export function estadoCopias(app) {
  const bd = app.bd("real");
  const hay = Object.values(recuentos(bd)).some((n) => n > 0);
  const ultima = listarCopias(app).find((c) => c.tipo === "copia" || c.tipo === "auto");
  const umbral = app.ctx("real").config().avisos.copia_dias;
  const hoyIso = isoLocal(app.reloj.ahora());
  const dias = ultima ? diasEntre(isoLocal(new Date(ultima.modificada)), hoyIso) : null;
  let aviso = null;
  if (hay && !ultima) aviso = "Todavía no has hecho ninguna copia de seguridad. Haz una y guarda una copia fuera de este ordenador.";
  else if (hay && dias > umbral) aviso = `La última copia es de hace ${dias} días. Haz una nueva y guarda una copia fuera de este ordenador (pendrive o nube).`;
  return { ultima: ultima || null, dias, aviso, hay_datos: hay };
}
