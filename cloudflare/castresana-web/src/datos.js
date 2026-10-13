// ============================================================================
//  Acceso a la base de datos D1
// ----------------------------------------------------------------------------
//  SQL SIEMPRE con parámetros (?): nunca se pega texto del cliente en la
//  consulta. Solo se usa la API estándar del binding de D1:
//  prepare().bind().first() / .all() / .run() y db.batch([...]).
// ============================================================================

/** ¿El error es un choque con un índice UNIQUE? (D1 y SQLite dan el mismo texto). */
export const esChoqueUnico = (e) => /UNIQUE constraint failed/i.test(String(e?.message || e));

// ---- Límite por IP ---------------------------------------------------------
/**
 * Suma un intento a la ventana actual y devuelve cuántos lleva. La ventana es
 * fija (por ejemplo, la hora en curso): sencillo y suficiente contra abusos.
 */
export async function sumaIntento(db, clave, ventanaS, ahoraMs) {
  const ventana = Math.floor(ahoraMs / 1000 / ventanaS) * ventanaS;
  const fila = await db.prepare(
    `INSERT INTO limites (clave, ventana, cuenta) VALUES (?, ?, 1)
     ON CONFLICT (clave, ventana) DO UPDATE SET cuenta = cuenta + 1
     RETURNING cuenta`).bind(clave, ventana).first();
  return Number(fila?.cuenta || 0);
}

/**
 * Devuelve un intento sumado con sumaIntento (mismo ahoraMs = misma ventana).
 * Sirve para «reservar» el intento antes de hacer algo y devolverlo si al
 * final no cuenta (una reserva que choca, una clave correcta).
 */
export async function restaIntento(db, clave, ventanaS, ahoraMs) {
  const ventana = Math.floor(ahoraMs / 1000 / ventanaS) * ventanaS;
  await db.prepare("UPDATE limites SET cuenta = cuenta - 1 WHERE clave = ? AND ventana = ? AND cuenta > 0").bind(clave, ventana).run();
}

export async function intentosEnVentana(db, clave, ventanaS, ahoraMs) {
  const ventana = Math.floor(ahoraMs / 1000 / ventanaS) * ventanaS;
  const fila = await db.prepare("SELECT cuenta FROM limites WHERE clave = ? AND ventana = ?").bind(clave, ventana).first();
  return Number(fila?.cuenta || 0);
}

/** Borra contadores de hace más de dos días (limpieza de paso). */
export async function limpiaLimites(db, ahoraMs) {
  await db.prepare("DELETE FROM limites WHERE ventana < ?").bind(Math.floor(ahoraMs / 1000) - 2 * 86400).run();
}

// ---- Valoraciones ------------------------------------------------------------
export async function guardaValoracion(db, v, ahoraIso) {
  const r = await db.prepare(
    `INSERT INTO valoraciones (creada, nombre, telefono, correo, operacion, tipo, zona, metros, habitaciones, comentario, privacidad)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(ahoraIso, v.nombre, v.telefono, v.correo, v.operacion, v.tipo, v.zona, v.metros ?? null, v.habitaciones ?? null, v.comentario, v.privacidad)
    .run();
  return r.meta?.last_row_id ?? null;
}

/** Derecho de supresión (RGPD): borra de verdad la solicitud. */
export async function borraValoracion(db, id) {
  return (await db.prepare("DELETE FROM valoraciones WHERE id = ?").bind(id).run()).meta?.changes || 0;
}

export async function listaValoraciones(db, limite = 300) {
  const { results } = await db.prepare("SELECT * FROM valoraciones ORDER BY creada DESC, id DESC LIMIT ?").bind(limite).all();
  return results || [];
}
export async function cuentaValoraciones(db) {
  const f = await db.prepare("SELECT COUNT(*) AS n FROM valoraciones").first();
  return Number(f?.n || 0);
}

// ---- Inmuebles -----------------------------------------------------------------
export async function inmueblesActivos(db) {
  const { results } = await db.prepare("SELECT referencia, titulo, zona, enlace FROM inmuebles WHERE activo = 1 ORDER BY referencia").all();
  return results || [];
}
export async function todosLosInmuebles(db) {
  const { results } = await db.prepare("SELECT * FROM inmuebles ORDER BY activo DESC, referencia").all();
  return results || [];
}
export async function inmueble(db, referencia) {
  return db.prepare("SELECT * FROM inmuebles WHERE referencia = ?").bind(referencia).first();
}

/** Inserta o actualiza la lista de golpe (una sola transacción con batch). */
export async function cargaInmuebles(db, lista, { desactivarResto = false }, ahoraIso) {
  const sentencias = lista.map((i) => db.prepare(
    `INSERT INTO inmuebles (referencia, titulo, zona, enlace, activo, actualizado) VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT (referencia) DO UPDATE SET titulo = excluded.titulo, zona = excluded.zona,
       enlace = excluded.enlace, activo = 1, actualizado = excluded.actualizado`)
    .bind(i.referencia, i.titulo, i.zona, i.enlace, ahoraIso));
  if (desactivarResto) {
    const huecos = lista.map(() => "?").join(", ");
    sentencias.push(db.prepare(`UPDATE inmuebles SET activo = 0, actualizado = ? WHERE referencia NOT IN (${huecos})`)
      .bind(ahoraIso, ...lista.map((i) => i.referencia)));
  }
  await db.batch(sentencias);
}

export async function cambiaInmueble(db, referencia, accion, ahoraIso) {
  if (accion === "borrar") return (await db.prepare("DELETE FROM inmuebles WHERE referencia = ?").bind(referencia).run()).meta?.changes || 0;
  const activo = accion === "activar" ? 1 : 0;
  return (await db.prepare("UPDATE inmuebles SET activo = ?, actualizado = ? WHERE referencia = ?").bind(activo, ahoraIso, referencia).run()).meta?.changes || 0;
}

// ---- Visitas y bloqueos -------------------------------------------------------
/** Horas ('AAAA-MM-DDTHH:MM') con visita activa entre dos fechas (incluidas). */
export async function huecosOcupados(db, desde, hasta) {
  const { results } = await db.prepare(
    "SELECT fecha_hora FROM visitas WHERE estado = 'activa' AND fecha_hora >= ? AND fecha_hora < ?")
    .bind(`${desde}T00:00`, `${hasta}T99:99`).all();
  return new Set((results || []).map((r) => r.fecha_hora));
}

export async function bloqueosEntre(db, desde, hasta) {
  const { results } = await db.prepare("SELECT id, fecha, hora, motivo FROM bloqueos WHERE fecha >= ? AND fecha <= ? ORDER BY fecha, hora")
    .bind(desde, hasta).all();
  return results || [];
}

export async function hayVisitaActiva(db, fechaHora) {
  return Boolean(await db.prepare("SELECT id FROM visitas WHERE fecha_hora = ? AND estado = 'activa'").bind(fechaHora).first());
}

/**
 * Inserta la visita. La comprobación de bloqueo y de inmueble activo va en la
 * MISMA sentencia (INSERT … SELECT … WHERE), y el índice único parcial
 * `visitas_sin_choques` impide dos visitas activas en el mismo hueco aunque
 * lleguen a la vez. Devuelve { ok, id, motivo: 'choque' | 'no-disponible' }.
 */
export async function reservaVisita(db, v, ahoraIso) {
  const [fecha, hora] = v.fechaHora.split("T");
  try {
    const r = await db.prepare(
      `INSERT INTO visitas (fecha_hora, inicio_utc, referencia, nombre, telefono, comentario, estado, creada)
       SELECT ?, ?, i.referencia, ?, ?, ?, 'activa', ?
       FROM inmuebles i
       WHERE i.referencia = ? AND i.activo = 1
         AND NOT EXISTS (SELECT 1 FROM bloqueos b WHERE b.fecha = ? AND (b.hora = '' OR b.hora = ?))`)
      .bind(v.fechaHora, v.inicioUtc, v.nombre, v.telefono, v.comentario, ahoraIso, v.referencia, fecha, hora)
      .run();
    if (!r.meta?.changes) return { ok: false, motivo: "no-disponible" };
    return { ok: true, id: r.meta.last_row_id ?? null };
  } catch (e) {
    if (esChoqueUnico(e)) return { ok: false, motivo: "choque" };
    throw e;
  }
}

export async function visitasEntre(db, desde, hasta) {
  const { results } = await db.prepare(
    "SELECT * FROM visitas WHERE fecha_hora >= ? AND fecha_hora < ? ORDER BY fecha_hora, estado")
    .bind(`${desde}T00:00`, `${hasta}T99:99`).all();
  return results || [];
}
export async function todasLasVisitas(db) {
  const { results } = await db.prepare("SELECT * FROM visitas ORDER BY fecha_hora DESC, id DESC").all();
  return results || [];
}

/** Cancela (no borra): queda en el historial y el hueco se libera. */
export async function cancelaVisita(db, id, ahoraIso) {
  const r = await db.prepare("UPDATE visitas SET estado = 'cancelada', cancelada = ? WHERE id = ? AND estado = 'activa'")
    .bind(ahoraIso, id).run();
  return r.meta?.changes || 0;
}

/**
 * Derecho de supresión (RGPD): borra la visita de verdad, no la cancela. Si
 * estaba activa, el hueco queda libre.
 */
export async function borraVisita(db, id) {
  return (await db.prepare("DELETE FROM visitas WHERE id = ?").bind(id).run()).meta?.changes || 0;
}

export async function creaBloqueo(db, b, ahoraIso) {
  try {
    await db.prepare("INSERT INTO bloqueos (fecha, hora, motivo, creado) VALUES (?, ?, ?, ?)").bind(b.fecha, b.hora, b.motivo, ahoraIso).run();
    return true;
  } catch (e) {
    if (esChoqueUnico(e)) return false;
    throw e;
  }
}
export async function quitaBloqueo(db, id) {
  return (await db.prepare("DELETE FROM bloqueos WHERE id = ?").bind(id).run()).meta?.changes || 0;
}
