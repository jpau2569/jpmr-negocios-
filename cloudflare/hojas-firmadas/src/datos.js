// ============================================================================
//  Acceso a la base de datos D1 de hojas-firmadas
// ----------------------------------------------------------------------------
//  SQL SIEMPRE con parámetros (?): nunca se pega texto de nadie en la
//  consulta. Solo la API estándar del binding de D1:
//  prepare().bind().first() / .all() / .run() y db.batch([...]).
// ============================================================================

export const esChoqueUnico = (e) => /UNIQUE constraint failed/i.test(String(e?.message || e));

// ---- Límites de intentos (igual que castresana-web) ------------------------------
/** Suma un intento a la ventana actual y devuelve cuántos lleva (atómico). */
export async function sumaIntento(db, clave, ventanaS, ahoraMs) {
  const ventana = Math.floor(ahoraMs / 1000 / ventanaS) * ventanaS;
  const fila = await db.prepare(
    `INSERT INTO limites (clave, ventana, cuenta) VALUES (?, ?, 1)
     ON CONFLICT (clave, ventana) DO UPDATE SET cuenta = cuenta + 1
     RETURNING cuenta`).bind(clave, ventana).first();
  return Number(fila?.cuenta || 0);
}
export async function restaIntento(db, clave, ventanaS, ahoraMs) {
  const ventana = Math.floor(ahoraMs / 1000 / ventanaS) * ventanaS;
  await db.prepare("UPDATE limites SET cuenta = cuenta - 1 WHERE clave = ? AND ventana = ? AND cuenta > 0").bind(clave, ventana).run();
}
export async function limpiaLimites(db, ahoraMs) {
  await db.prepare("DELETE FROM limites WHERE ventana < ?").bind(Math.floor(ahoraMs / 1000) - 2 * 86400).run();
}

// ---- Ajustes (marca, textos, logo) ------------------------------------------------
export async function leeAjuste(db, clave) {
  const f = await db.prepare("SELECT valor FROM ajustes WHERE clave = ?").bind(clave).first();
  if (!f) return null;
  try { return JSON.parse(f.valor); } catch { return null; }
}
export async function guardaAjuste(db, clave, valor, ahoraIso) {
  await db.prepare(
    `INSERT INTO ajustes (clave, valor, actualizado) VALUES (?, ?, ?)
     ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor, actualizado = excluded.actualizado`)
    .bind(clave, JSON.stringify(valor), ahoraIso).run();
}
export async function borraAjuste(db, clave) {
  await db.prepare("DELETE FROM ajustes WHERE clave = ?").bind(clave).run();
}

// ---- Hojas -------------------------------------------------------------------------
/**
 * Guarda una hoja SIN DUPLICAR (la cola del móvil puede mandarla dos veces):
 *  · INSERT … ON CONFLICT (id) DO NOTHING: la segunda vez no inserta nada;
 *  · y no se inserta si esa hoja se borró por supresión (registro 'borrada').
 * Devuelve 'nueva' | 'repetida' (mismo id y mismo SHA-256) |
 *         'conflicto' (mismo id con otro contenido) | 'borrada'.
 */
export async function guardaHoja(db, f) {
  const r = await db.prepare(
    `INSERT INTO hojas (id, tipo, referencia, inmueble, nombre, busqueda, agente_id, agente, firmada, recibida, ip, contenido, hash, textos_al_dia, marca_al_dia)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM registro WHERE hoja = ? AND accion = 'borrada')
     ON CONFLICT (id) DO NOTHING`)
    .bind(f.id, f.tipo, f.referencia, f.inmueble, f.nombre, f.busqueda, f.agenteId, f.agente, f.firmada, f.recibida, f.ip, f.contenido, f.hash,
      f.textosAlDia ? 1 : 0, f.marcaAlDia ? 1 : 0, f.id)
    .run();
  if (r.meta?.changes) return "nueva";
  const existente = await db.prepare("SELECT hash FROM hojas WHERE id = ?").bind(f.id).first();
  if (existente) return existente.hash === f.hash ? "repetida" : "conflicto";
  return "borrada";
}

/** Escapa los comodines de LIKE (% _ \) para buscar el texto tal cual. */
export const comoLike = (t) => `%${String(t).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const COLUMNAS_LISTA = "id, tipo, referencia, inmueble, nombre, agente, firmada, recibida, hash, estado, anulada, motivo, textos_al_dia, marca_al_dia";

/**
 * Lista (sin el contenido ni las firmas). filtros: { tipo, desdeUtc,
 * hastaUtc, referencia, nombre, limite, agenteId }. agenteId = null: todas;
 * un número: solo las de ese agente (ajuste «Los agentes solo ven sus hojas»).
 */
export async function listaHojas(db, { tipo = "", desdeUtc = "", hastaUtc = "", referencia = "", nombre = "", limite = 200, agenteId = null } = {}) {
  const soloDe = agenteId === null ? -1 : agenteId;
  const { results } = await db.prepare(
    `SELECT ${COLUMNAS_LISTA} FROM hojas
     WHERE (? = '' OR tipo = ?)
       AND (? = '' OR firmada >= ?)
       AND (? = '' OR firmada < ?)
       AND (? = '' OR referencia LIKE ? ESCAPE '\\')
       AND (? = '' OR busqueda LIKE ? ESCAPE '\\')
       AND (? = -1 OR agente_id = ?)
     ORDER BY firmada DESC, id
     LIMIT ?`)
    .bind(tipo, tipo, desdeUtc, desdeUtc, hastaUtc, hastaUtc, referencia, comoLike(referencia), nombre, comoLike(nombre), soloDe, soloDe, limite)
    .all();
  return results || [];
}

export async function cuentaHojas(db, agenteId = null) {
  const soloDe = agenteId === null ? -1 : agenteId;
  return Number((await db.prepare("SELECT COUNT(*) AS n FROM hojas WHERE (? = -1 OR agente_id = ?)").bind(soloDe, soloDe).first())?.n || 0);
}

export async function leeHoja(db, id) {
  return db.prepare("SELECT * FROM hojas WHERE id = ?").bind(id).first();
}

/**
 * Para el CSV: los datos de contacto se sacan del JSON con json_extract en la
 * propia base de datos, para no cargar las firmas de miles de hojas.
 */
export async function filasCsv(db, limite = 20000) {
  const { results } = await db.prepare(
    `SELECT id, tipo, estado, firmada, recibida, referencia, inmueble, nombre, agente, hash, anulada, motivo, textos_al_dia, marca_al_dia,
       CASE tipo WHEN 'visita' THEN json_extract(contenido, '$.datos.visitante.dni') ELSE json_extract(contenido, '$.datos.piso.propDni') END AS dni,
       CASE tipo WHEN 'visita' THEN json_extract(contenido, '$.datos.visitante.telefono') ELSE json_extract(contenido, '$.datos.piso.propTelefono') END AS telefono,
       CASE tipo WHEN 'visita' THEN json_extract(contenido, '$.datos.visitante.email') ELSE json_extract(contenido, '$.datos.piso.propEmail') END AS correo,
       CASE tipo WHEN 'visita' THEN json_extract(contenido, '$.datos.fecha') || ' ' || json_extract(contenido, '$.datos.hora') ELSE '' END AS visita
     FROM hojas ORDER BY firmada DESC LIMIT ?`).bind(limite).all();
  return results || [];
}

/**
 * Anula: no borra ni cambia lo firmado. Deja fecha, motivo y quién, y una
 * línea en el registro, LAS DOS COSAS EN UN SOLO db.batch (una transacción):
 * o se hacen las dos o ninguna. El INSERT solo escribe si la hoja ha quedado
 * anulada y aún no tenía su línea (una hoja se anula una sola vez), así que
 * si el UPDATE no cambia nada tampoco se escribe en el registro.
 * Devuelve 1 si la anuló, 0 si no existía o ya estaba anulada.
 */
export async function anulaHoja(db, id, { cuando, motivo, quien }) {
  const res = await db.batch([
    db.prepare("UPDATE hojas SET estado = 'anulada', anulada = ?, motivo = ?, anulada_por = ? WHERE id = ? AND estado = 'firmada'")
      .bind(cuando, motivo, quien, id),
    db.prepare(
      `INSERT INTO registro (cuando, quien, accion, hoja, tipo, detalle)
       SELECT ?, ?, 'anulada', id, tipo, ? FROM hojas
       WHERE id = ? AND estado = 'anulada' AND anulada = ?
         AND NOT EXISTS (SELECT 1 FROM registro WHERE hoja = ? AND accion = 'anulada')`)
      .bind(cuando, quien, motivo, id, cuando, id),
  ]);
  return res[0]?.meta?.changes || 0;
}

/**
 * Derecho de supresión: borra la hoja DE VERDAD (datos y firmas) y también
 * el motivo de su anulación, si lo había. Queda solo que existió una hoja
 * con ese id, su tipo, cuándo se borró y quién lo hizo (así una cola vieja
 * de un móvil no la puede volver a subir). Todo en una transacción.
 * EL ORDEN IMPORTA: primero la línea «borrada» del registro y después el
 * DELETE, porque el trigger hojas_sin_borrar de schema.sql no deja borrar
 * una hoja que no tenga esa línea.
 */
export async function borraHoja(db, id, { cuando, quien }) {
  const res = await db.batch([
    db.prepare("INSERT INTO registro (cuando, quien, accion, hoja, tipo, detalle) SELECT ?, ?, 'borrada', id, tipo, '' FROM hojas WHERE id = ?").bind(cuando, quien, id),
    db.prepare("DELETE FROM registro WHERE hoja = ? AND accion = 'anulada'").bind(id),
    db.prepare("DELETE FROM hojas WHERE id = ?").bind(id),
  ]);
  return res[2]?.meta?.changes || 0;
}

export async function listaRegistro(db, limite = 100) {
  const { results } = await db.prepare("SELECT id, cuando, quien, accion, hoja, tipo, detalle FROM registro ORDER BY id DESC LIMIT ?").bind(limite).all();
  return results || [];
}

// ---- Versión de la sesión (cerrar sesión de verdad) --------------------------------
export async function versionTitular(db) {
  return Number((await db.prepare("SELECT version FROM sesion_titular WHERE id = 1").first())?.version || 0);
}
/** «Salir» del titular: sube la versión y su cookie deja de valer en el servidor. */
export async function subeVersionTitular(db) {
  await db.prepare(
    `INSERT INTO sesion_titular (id, version) VALUES (1, 1)
     ON CONFLICT (id) DO UPDATE SET version = version + 1`).run();
}
/** «Salir» de un agente: sube su versión (como al cambiarle la clave). */
export async function subeVersionAgente(db, id) {
  await db.prepare("UPDATE agentes SET version = version + 1 WHERE id = ?").bind(id).run();
}

// ---- Agentes --------------------------------------------------------------------
export async function listaAgentes(db) {
  const { results } = await db.prepare("SELECT id, nombre, usuario, activo, creado FROM agentes ORDER BY activo DESC, nombre").all();
  return results || [];
}
export async function agentePorUsuario(db, usuario) {
  return db.prepare("SELECT * FROM agentes WHERE usuario = ? AND activo = 1").bind(usuario).first();
}
export async function agentePorId(db, id) {
  return db.prepare("SELECT * FROM agentes WHERE id = ?").bind(id).first();
}
/** Devuelve el id nuevo o null si el usuario ya existe. */
export async function creaAgente(db, { nombre, usuario, sal, hash, iteraciones }, ahoraIso) {
  try {
    const r = await db.prepare("INSERT INTO agentes (nombre, usuario, sal, hash, iteraciones, version, activo, creado) VALUES (?, ?, ?, ?, ?, 1, 1, ?)")
      .bind(nombre, usuario, sal, hash, iteraciones, ahoraIso).run();
    return r.meta?.last_row_id ?? null;
  } catch (e) {
    if (esChoqueUnico(e)) return null;
    throw e;
  }
}
/** Nueva clave: sube la versión (cierra sus sesiones abiertas). */
export async function cambiaClaveAgente(db, id, { sal, hash, iteraciones }) {
  return (await db.prepare("UPDATE agentes SET sal = ?, hash = ?, iteraciones = ?, version = version + 1 WHERE id = ? AND activo = 1")
    .bind(sal, hash, iteraciones, id).run()).meta?.changes || 0;
}
/** Baja: no se borra (sus hojas siguen diciendo quién las firmó), pero no puede entrar. */
export async function bajaAgente(db, id) {
  return (await db.prepare("UPDATE agentes SET activo = 0, version = version + 1 WHERE id = ? AND activo = 1").bind(id).run()).meta?.changes || 0;
}
