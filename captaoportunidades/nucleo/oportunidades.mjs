// ============================================================================
//  Oportunidades y captación.
//  Reglas del embudo (todas se explican al usuario en lenguaje llano):
//   - Descartar o marcar «No contactar» exige un motivo.
//   - Para pasar a cualquier estado de contacto hay que haber VERIFICADO que se
//     puede contactar y anotado la evidencia (p. ej. «el propietario nos llamó»).
//   - Un contacto «No contactar» bloquea el avance; y salir de «No contactar»
//     exige levantar el bloqueo dejando el motivo.
//   - «Encargo confirmado» solo se alcanza con «Confirmar encargo»: crea o
//     reutiliza el inmueble, vincula al propietario y conserva todo el historial.
// ============================================================================
import { insertar, actualizar, siguienteContador } from "./bd.mjs";
import { limpiar, exige, OPORTUNIDAD, INMUEBLE, ENCARGO } from "./campos.mjs";
import * as auditoria from "./auditoria.mjs";
import { patronLike, paginacion } from "./config.mjs";
import * as contactos from "./contactos.mjs";
import * as inmuebles from "./inmuebles.mjs";
import { noEncontrado, invalido, conflicto, normaliza, urlNorm, sello, hoy, exigeVersion } from "./util.mjs";
import { ESTADOS_OPORTUNIDAD, ESTADOS_CON_CONTACTO, claves } from "./catalogos.mjs";

const ESTADOS = claves(ESTADOS_OPORTUNIDAD);

export function obtenerFila(ctx, id) {
  const f = ctx.bd.uno("SELECT * FROM oportunidades WHERE id = ?", [id]);
  if (!f) throw noEncontrado("La oportunidad");
  return f;
}

function generarIdentificador(ctx) {
  const cfg = ctx.config().referencias;
  const anio = ctx.reloj.ahora().getFullYear();
  for (;;) {
    const n = siguienteContador(ctx.bd, `oportunidad-${anio}`);
    const id = `${cfg.oportunidad_prefijo}-${anio}-${String(n).padStart(4, "0")}`;
    if (!ctx.bd.uno("SELECT 1 FROM oportunidades WHERE identificador = ?", [id])) return id;
  }
}

function reglas(datos, errores) {
  if (datos.clasificacion_anunciante && datos.clasificacion_anunciante !== "sin_verificar" && !datos.evidencia_clasificacion) {
    errores.evidencia_clasificacion = "Anota en qué te basas para clasificar al anunciante (por ejemplo: «el anuncio muestra el logotipo de una agencia»).";
  }
  if (datos.verificacion_contacto === "permitido" && !datos.verificacion_evidencia) {
    errores.verificacion_evidencia = "Anota la evidencia de que se puede contactar (por ejemplo: «el propietario nos escribió él primero» o «el anuncio invita a contactar por el portal»).";
  }
}

function duplicadosPorEnlace(ctx, enlace, excluirId = null) {
  const n = urlNorm(enlace);
  if (!n) return [];
  return ctx.bd.todos(
    "SELECT id, identificador, titulo, estado, municipio, fecha_deteccion FROM oportunidades WHERE enlace_norm = ? AND id IS NOT ?", [n, excluirId]);
}

// ------------------------------------------------------------ transiciones ----
/** ¿Se puede pasar a `nuevo`? Devuelve el porqué cuando no. */
export function evaluarTransicion(ctx, o, nuevo, contacto, { levantando = false } = {}) {
  if (nuevo === o.estado) return { ok: false, motivo: "Ya está en ese estado." };
  if (o.estado === "encargo_confirmado") {
    return { ok: false, motivo: "El encargo ya está confirmado. Si se cancela o termina, se gestiona desde el inmueble." };
  }
  if (nuevo === "encargo_confirmado") {
    return { ok: false, via: "confirmar_encargo", motivo: "Usa «Confirmar encargo»: así se crea el inmueble y se vincula al propietario." };
  }
  const requiere = [];
  if (o.estado === "no_contactar") requiere.push("levantar_no_contactar", "motivo");
  if (nuevo === "descartada" || nuevo === "no_contactar") requiere.push("motivo");
  if (ESTADOS_CON_CONTACTO.includes(nuevo)) {
    if (o.verificacion_contacto === "no_permitido") return { ok: false, motivo: "La verificación de contacto está marcada como «contacto no permitido»." };
    if (o.verificacion_contacto !== "permitido" || !o.verificacion_evidencia) {
      return { ok: false, accion: "verificar", motivo: "Antes de pasar a contacto, verifica que se puede contactar y anota la evidencia (edita la oportunidad)." };
    }
    if (contacto?.no_contactar && !levantando) return { ok: false, motivo: "El propietario figura como «No contactar»." };
  }
  return { ok: true, requiere: [...new Set(requiere)] };
}

export function cambiarEstado(ctx, id, cuerpo = {}) {
  const nuevo = String(cuerpo.estado ?? "");
  if (!ESTADOS.includes(nuevo)) throw invalido("Estado no válido.", { estado: "Estado no válido." });
  const o = obtenerFila(ctx, id);
  const motivo = String(cuerpo.motivo ?? "").trim();
  const levantando = o.estado === "no_contactar" && cuerpo.levantar_no_contactar === true;
  const contacto = o.contacto_id ? contactos.obtenerFila(ctx, o.contacto_id) : null;
  const ev = evaluarTransicion(ctx, o, nuevo, contacto, { levantando });
  if (!ev.ok) throw conflicto("transicion_no_permitida", ev.motivo, { via: ev.via, accion: ev.accion });
  if (ev.requiere.includes("motivo") && !motivo) {
    throw invalido(nuevo === "no_contactar" ? "Indica por qué es «No contactar»." : nuevo === "descartada" ? "Indica el motivo del descarte." : "Indica el motivo del cambio.", { motivo: "Indica el motivo." });
  }
  if (motivo.length > 300) throw invalido("El motivo es demasiado largo (máximo 300 caracteres).", { motivo: "Demasiado largo." });
  if (ev.requiere.includes("levantar_no_contactar") && !levantando) {
    throw conflicto("requiere_levantar", "Esta oportunidad está en «No contactar». Para reabrirla confirma que se levanta el bloqueo y explica el motivo.", { requiere: "levantar_no_contactar" });
  }
  const avisos = [];
  if (ESTADOS_CON_CONTACTO.includes(nuevo)) {
    if (o.clasificacion_anunciante === "sin_verificar") avisos.push("El anunciante está «sin verificar»: confirma si es particular o profesional.");
    if (o.clasificacion_anunciante === "profesional") avisos.push("El anunciante figura como profesional: comprueba que tiene sentido contactarlo.");
  }
  ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    if (levantando && contacto?.no_contactar) contactos.levantarNoContactar(ctx, contacto.id, { motivo });
    let estadoActual = o.estado;
    if (nuevo === "no_contactar" && contacto && cuerpo.marcar_contacto !== false && !contacto.no_contactar) {
      contactos.marcarNoContactar(ctx, contacto.id, { motivo }); // arrastra también esta oportunidad
      estadoActual = obtenerFila(ctx, id).estado;
    }
    if (estadoActual !== nuevo) {
      actualizar(ctx.bd, "oportunidades", id, { estado: nuevo, estado_desde: ahora, actualizado_en: ahora });
      auditoria.registrar(ctx, "oportunidad", id, "estado", { campo: "estado", antes: o.estado, despues: nuevo });
    }
    const dejaCerrado = ["descartada", "no_contactar"].includes(o.estado) && !["descartada", "no_contactar"].includes(nuevo);
    if (nuevo === "descartada" || nuevo === "no_contactar") {
      actualizar(ctx.bd, "oportunidades", id, { motivo_descarte: motivo, actualizado_en: ahora });
    } else if (dejaCerrado) {
      actualizar(ctx.bd, "oportunidades", id, { motivo_descarte: null, actualizado_en: ahora });
    }
  });
  return { oportunidad: obtener(ctx, id), avisos };
}

// ----------------------------------------------------------------- consultas ----
export function listar(ctx, q = {}) {
  const { limite, offset } = paginacion(q);
  const donde = ["1 = 1"];
  const p = [];
  if (q.q) {
    donde.push(`norm(o.identificador || ' ' || COALESCE(o.titulo, '') || ' ' || o.municipio || ' ' || COALESCE(o.zona, '') || ' ' || COALESCE(o.fuente_detalle, '') || ' ' || COALESCE(o.enlace, '')) LIKE ? ESCAPE '\\'`);
    p.push(patronLike(normaliza(q.q)));
  }
  if (q.fuente) donde.push("norm(o.fuente) = ?"), p.push(normaliza(q.fuente));
  if (q.municipio) donde.push("norm(o.municipio) = ?"), p.push(normaliza(q.municipio));
  if (q.responsable) donde.push("norm(o.responsable) = ?"), p.push(normaliza(q.responsable));
  if (q.clasificacion) donde.push("o.clasificacion_anunciante = ?"), p.push(q.clasificacion);
  if (q.tipo) donde.push("norm(o.tipo_inmueble) = ?"), p.push(normaliza(q.tipo));
  if (q.contacto_id) donde.push("o.contacto_id = ?"), p.push(Number(q.contacto_id));
  if (q.desde) donde.push("o.fecha_deteccion >= ?"), p.push(q.desde);
  if (q.hasta) donde.push("o.fecha_deteccion <= ?"), p.push(q.hasta);
  const baseWhere = donde.join(" AND ");
  const conteo = {};
  for (const f of ctx.bd.todos(`SELECT o.estado, COUNT(*) AS n FROM oportunidades o WHERE ${baseWhere} GROUP BY o.estado`, p)) conteo[f.estado] = f.n;

  const dEstado = [...donde];
  const pEstado = [...p];
  if (q.estado === "abiertas") dEstado.push(`o.estado NOT IN ('encargo_confirmado','descartada','no_contactar')`);
  else if (q.estado?.startsWith("grupo:")) {
    const g = q.estado.slice(6);
    const miembros = ESTADOS_OPORTUNIDAD.filter((e) => e.grupo === g).map((e) => e.clave);
    if (miembros.length) dEstado.push(`o.estado IN (${miembros.map(() => "?").join(",")})`), pEstado.push(...miembros);
  } else if (q.estado) dEstado.push("o.estado = ?"), pEstado.push(q.estado);
  const orden = { precio_desc: "o.precio_anunciado DESC", precio_asc: "o.precio_anunciado ASC", antiguas: "o.fecha_deteccion ASC, o.id ASC", proxima: "COALESCE(o.proxima_accion_fecha, '9999-12-31') ASC" }[q.orden]
    || "o.fecha_deteccion DESC, o.id DESC";
  const where = dEstado.join(" AND ");
  const total = ctx.bd.valor(`SELECT COUNT(*) FROM oportunidades o WHERE ${where}`, pEstado);
  const ahora = ctx.reloj.ahora().getTime();
  const filas = ctx.bd.todos(
    `SELECT o.*, c.nombre AS contacto_nombre, c.apellidos AS contacto_apellidos, c.no_contactar AS contacto_no_contactar
     FROM oportunidades o LEFT JOIN contactos c ON c.id = o.contacto_id WHERE ${where} ORDER BY ${orden} LIMIT ? OFFSET ?`,
    [...pEstado, limite, offset],
  ).map((f) => ({ ...f, dias_en_estado: Math.max(0, Math.floor((ahora - Date.parse(f.estado_desde)) / 86400000)) }));
  return { datos: filas, total, limite, offset, conteo_estados: conteo };
}

export function obtener(ctx, id) {
  const o = obtenerFila(ctx, id);
  const bd = ctx.bd;
  const contacto = o.contacto_id ? contactos.obtenerFila(ctx, o.contacto_id) : null;
  const inmueble = o.inmueble_id ? bd.uno("SELECT id, referencia, titulo, estado_comercial, precio_actual FROM inmuebles WHERE id = ?", [o.inmueble_id]) : null;
  const transiciones = ESTADOS_OPORTUNIDAD.map((e) => ({ estado: e.clave, etiqueta: e.etiqueta, ...evaluarTransicion(ctx, o, e.clave, contacto) }));
  const alertas = [];
  if (contacto?.no_contactar) alertas.push({ nivel: "bloqueo", texto: "El propietario figura como «No contactar»." });
  if (o.clasificacion_anunciante === "profesional") alertas.push({ nivel: "aviso", texto: "El anunciante figura como profesional." });
  if (o.verificacion_contacto === "no_permitido") alertas.push({ nivel: "bloqueo", texto: "El contacto está marcado como no permitido." });
  const ahora = ctx.reloj.ahora().getTime();
  return {
    ...o,
    dias_en_estado: Math.max(0, Math.floor((ahora - Date.parse(o.estado_desde)) / 86400000)),
    contacto: contacto ? { id: contacto.id, nombre_completo: contactos.nombreCompleto(contacto), telefono: contacto.telefono, email: contacto.email, no_contactar: contacto.no_contactar } : null,
    inmueble, transiciones, alertas,
    actividades: bd.todos("SELECT * FROM actividades WHERE oportunidad_id = ? ORDER BY fecha DESC, COALESCE(hora, '') DESC, id DESC LIMIT 80", [id]),
    tareas: bd.todos("SELECT * FROM tareas WHERE oportunidad_id = ? ORDER BY CASE WHEN estado IN ('pendiente','en_curso') THEN 0 ELSE 1 END, fecha, COALESCE(hora, '99:99') LIMIT 50", [id]),
    cambios: auditoria.historial(ctx, "oportunidad", id, 100),
  };
}

// ---------------------------------------------------------------- escritura ----
function exigeContacto(ctx, contactoId, errores) {
  if (contactoId && !ctx.bd.uno("SELECT 1 FROM contactos WHERE id = ?", [contactoId])) errores.contacto_id = "El propietario elegido ya no existe.";
}

export function crear(ctx, entrada, { confirmar_duplicado = false } = {}) {
  const { valores, errores } = limpiar(OPORTUNIDAD, entrada, { cat: ctx.cat });
  valores.fecha_deteccion = valores.fecha_deteccion || hoy(ctx.reloj);
  valores.responsable = valores.responsable || ctx.usuario();
  valores.verificacion_contacto = valores.verificacion_contacto || "sin_verificar";
  reglas(valores, errores);
  exigeContacto(ctx, valores.contacto_id, errores);
  exige(errores);
  const dup = duplicadosPorEnlace(ctx, valores.enlace);
  if (dup.length && !confirmar_duplicado) {
    throw conflicto("duplicado_posible", "Este enlace ya está registrado en otra oportunidad. Revísala antes de crear una repetida.", { candidatos: dup });
  }
  const id = ctx.bd.transaccion(() => {
    const ahora = sello(ctx.reloj);
    const nuevo = insertar(ctx.bd, "oportunidades", {
      ...valores,
      identificador: generarIdentificador(ctx),
      enlace_norm: urlNorm(valores.enlace),
      verificacion_fecha: valores.verificacion_contacto === "sin_verificar" ? null : hoy(ctx.reloj),
      estado: "detectada", estado_desde: ahora, creado_en: ahora, actualizado_en: ahora,
    });
    auditoria.registrar(ctx, "oportunidad", nuevo, "crear", { resumen: "Oportunidad registrada." });
    return nuevo;
  });
  return obtener(ctx, id);
}

export function actualizarOportunidad(ctx, id, entrada, { confirmar_duplicado = false } = {}) {
  const actual = obtenerFila(ctx, id);
  exigeVersion(entrada, actual);
  const { valores, errores } = limpiar(OPORTUNIDAD, entrada, { parcial: true, cat: ctx.cat });
  for (const k of ["fecha_deteccion", "fuente", "tipo_inmueble", "municipio"]) if (valores[k] === null) delete valores[k];
  if (valores.clasificacion_anunciante === null) valores.clasificacion_anunciante = "sin_verificar";
  if (valores.verificacion_contacto === null) valores.verificacion_contacto = "sin_verificar";
  reglas({ ...actual, ...valores }, errores);
  exigeContacto(ctx, valores.contacto_id, errores);
  if (valores.verificacion_contacto === "no_permitido" && ESTADOS_CON_CONTACTO.includes(actual.estado)) {
    errores.verificacion_contacto = "No puedes marcar el contacto como no permitido mientras la oportunidad está en un estado de contacto. Cámbiala antes de estado.";
  }
  if (valores.verificacion_contacto && valores.verificacion_contacto !== "permitido" && ESTADOS_CON_CONTACTO.includes(actual.estado)) {
    errores.verificacion_contacto = "La oportunidad ya está en contacto: la verificación debe seguir siendo «permitido». Si ya no es así, cambia antes el estado.";
  }
  if (valores.contacto_id && valores.contacto_id !== actual.contacto_id && ESTADOS_CON_CONTACTO.includes(actual.estado)
    && ctx.bd.valor("SELECT no_contactar FROM contactos WHERE id = ?", [valores.contacto_id]) === 1) {
    errores.contacto_id = "Esa persona figura como «No contactar»: no se puede asignar a una oportunidad que ya está en contacto.";
  }
  exige(errores);
  if ("enlace" in valores && valores.enlace && valores.enlace !== actual.enlace) {
    const dup = duplicadosPorEnlace(ctx, valores.enlace, id);
    if (dup.length && !confirmar_duplicado) throw conflicto("duplicado_posible", "Ese enlace ya está registrado en otra oportunidad.", { candidatos: dup });
  }
  ctx.bd.transaccion(() => {
    const extra = {};
    if ("enlace" in valores) extra.enlace_norm = urlNorm(valores.enlace);
    if (("verificacion_contacto" in valores && valores.verificacion_contacto !== actual.verificacion_contacto) || ("verificacion_evidencia" in valores)) {
      extra.verificacion_fecha = (valores.verificacion_contacto ?? actual.verificacion_contacto) === "sin_verificar" ? null : hoy(ctx.reloj);
    }
    auditoria.registrarDiff(ctx, "oportunidad", id, OPORTUNIDAD, actual, valores);
    actualizar(ctx.bd, "oportunidades", id, { ...valores, ...extra, actualizado_en: sello(ctx.reloj) });
  });
  return obtener(ctx, id);
}

export function eliminar(ctx, id) {
  const o = obtenerFila(ctx, id);
  const origen = ctx.bd.valor("SELECT COUNT(*) FROM inmuebles WHERE oportunidad_origen_id = ?", [id]);
  if (o.inmueble_id || origen > 0 || o.estado === "encargo_confirmado") {
    throw conflicto("oportunidad_con_inmueble",
      "Esta oportunidad dio lugar a un inmueble: es su historial de captación y no se puede borrar. Si ya no interesa, archiva el inmueble.");
  }
  ctx.bd.transaccion(() => {
    ctx.bd.ejecutar("DELETE FROM actividades WHERE oportunidad_id = ? AND inmueble_id IS NULL AND demanda_id IS NULL", [id]);
    ctx.bd.ejecutar("DELETE FROM tareas WHERE oportunidad_id = ? AND inmueble_id IS NULL AND demanda_id IS NULL", [id]);
    ctx.bd.ejecutar("DELETE FROM oportunidades WHERE id = ?", [id]);
    auditoria.registrar(ctx, "oportunidad", id, "eliminar", { resumen: `Oportunidad ${o.identificador} eliminada.` });
  });
  return { eliminado: true };
}

// ------------------------------------------------------ confirmar encargo ----
const DATOS_DE_ANUNCIO = ["superficie_m2", "habitaciones", "banos", "caracteristicas", "precio_actual"];

export function previsualizarEncargo(ctx, id) {
  const o = obtenerFila(ctx, id);
  return {
    oportunidad: { id: o.id, identificador: o.identificador, estado: o.estado, contacto_id: o.contacto_id },
    similares: o.inmueble_id ? [] : inmuebles.buscarSimilares(ctx, o),
    inmueble_vinculado: o.inmueble_id,
    precio_sugerido: o.precio_anunciado,
  };
}

export function confirmarEncargo(ctx, id, cuerpo = {}) {
  const o = obtenerFila(ctx, id);
  if (o.estado === "encargo_confirmado") {
    throw conflicto("ya_confirmado", "El encargo de esta oportunidad ya está confirmado.", { inmueble_id: o.inmueble_id });
  }
  if (o.estado === "descartada" || o.estado === "no_contactar") {
    throw conflicto("oportunidad_cerrada", "Esta oportunidad está cerrada. Reábrela antes de confirmar un encargo.");
  }
  if (o.verificacion_contacto === "no_permitido") {
    throw conflicto("contacto_no_permitido", "La verificación de contacto de esta oportunidad figura como «contacto no permitido». Revísala antes de confirmar un encargo.");
  }
  // Validar todo antes de escribir nada.
  const { valores: enc, errores } = limpiar(ENCARGO, cuerpo.encargo || {});
  enc.fecha_encargo = enc.fecha_encargo || hoy(ctx.reloj);
  if (enc.vigencia_hasta && enc.vigencia_hasta < enc.fecha_encargo) errores.vigencia_hasta = "La vigencia no puede ser anterior a la fecha del encargo.";
  if (enc.honorarios_tipo && enc.honorarios_tipo !== "sin_definir" && enc.honorarios_valor == null) errores.honorarios_valor = "Indica el importe o el porcentaje de los honorarios.";
  const { valores: overlay, errores: errOverlay } = limpiar(INMUEBLE, cuerpo.inmueble || {}, { parcial: true, cat: ctx.cat });
  Object.assign(errores, errOverlay);
  exige(errores);

  const resultado = ctx.bd.transaccion(() => {
    // 1. Propietario principal
    let contactoId = o.contacto_id || (cuerpo.contacto_id ? Number(cuerpo.contacto_id) : null);
    if (!contactoId && cuerpo.contacto) {
      contactoId = contactos.crear(ctx, { ...cuerpo.contacto, es_propietario: true }, { confirmar_duplicado: cuerpo.confirmar_duplicado === true }).id;
    }
    if (!contactoId) {
      throw invalido("Para confirmar un encargo necesito saber quién es el propietario: elige un contacto o crea uno nuevo.", { contacto_id: "Falta el propietario." });
    }
    const contacto = contactos.obtenerFila(ctx, contactoId);
    if (contacto.no_contactar) {
      throw conflicto("contacto_no_contactar", "El propietario figura como «No contactar». Levanta antes el bloqueo, dejando el motivo, si ha vuelto a ponerse en contacto.");
    }

    // 2. Inmueble: reutilizar o crear (sin duplicar)
    let inmuebleId = o.inmueble_id || (cuerpo.inmueble_id ? Number(cuerpo.inmueble_id) : null);
    let reutilizado = false;
    if (inmuebleId) {
      inmuebles.obtenerFila(ctx, inmuebleId);
      reutilizado = true;
    } else {
      const similares = inmuebles.buscarSimilares(ctx, o);
      if (similares.length && cuerpo.crear_nuevo !== true) {
        throw conflicto("inmueble_similar",
          "Ya hay en tu cartera un inmueble que parece el mismo. Elige usarlo o confirma que quieres crear uno nuevo.", { candidatos: similares });
      }
      const base = {
        tipo: o.tipo_inmueble, municipio: o.municipio, zona: o.zona, operacion: enc.tipo === "alquiler" ? "alquiler" : "venta",
        superficie_m2: o.superficie_m2, habitaciones: o.habitaciones, banos: o.banos, caracteristicas: o.caracteristicas,
        precio_actual: o.precio_anunciado, titulo: o.titulo, estado_comercial: "en_preparacion",
      };
      const v = { ...base, ...Object.fromEntries(Object.entries(overlay).filter(([, x]) => x !== null)) };
      v.datos_pendientes = DATOS_DE_ANUNCIO.filter((k) => v[k] !== null && v[k] !== undefined && !(k in overlay && overlay[k] !== null));
      inmuebleId = inmuebles.crearFila(ctx, v, { oportunidad_origen_id: o.id }, { motivoPrecio: `Precio del anuncio (${o.identificador})` });
    }
    const inm = inmuebles.obtenerFila(ctx, inmuebleId);
    if (!inm.oportunidad_origen_id) actualizar(ctx.bd, "inmuebles", inmuebleId, { oportunidad_origen_id: o.id });

    // 3. Propietarios
    const quienes = [{ contacto_id: contactoId, porcentaje: null }, ...(Array.isArray(cuerpo.propietarios) ? cuerpo.propietarios : [])];
    for (const p of quienes) {
      if (ctx.bd.uno("SELECT 1 FROM inmueble_propietarios WHERE inmueble_id = ? AND contacto_id = ?", [inmuebleId, Number(p.contacto_id)])) continue;
      inmuebles.anadirPropietario(ctx, inmuebleId, p);
    }

    // 4. Encargo
    const encargo = inmuebles.crearEncargo(ctx, inmuebleId, { ...cuerpo.encargo, fecha_encargo: enc.fecha_encargo }, { oportunidad_id: o.id });

    // 5. La oportunidad queda enlazada y en "Encargo confirmado"
    const ahora = sello(ctx.reloj);
    actualizar(ctx.bd, "oportunidades", id, { estado: "encargo_confirmado", estado_desde: ahora, inmueble_id: inmuebleId, contacto_id: contactoId, actualizado_en: ahora });
    auditoria.registrar(ctx, "oportunidad", id, "estado", { campo: "estado", antes: o.estado, despues: "encargo_confirmado" });
    auditoria.registrar(ctx, "oportunidad", id, "vincular", { campo: "inmueble", resumen: `Encargo confirmado; inmueble ${inm.referencia} ${reutilizado ? "reutilizado" : "creado"}.` });
    return { inmuebleId, encargoId: encargo.id, reutilizado };
  });

  return {
    oportunidad: obtener(ctx, id),
    inmueble: inmuebles.obtener(ctx, resultado.inmuebleId),
    encargo_id: resultado.encargoId,
    inmueble_reutilizado: resultado.reutilizado,
  };
}

