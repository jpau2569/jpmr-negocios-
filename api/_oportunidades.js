// ============================================================================
//  OPORTUNIDADES ÚNICAS — backend (Vercel + Supabase)
// ----------------------------------------------------------------------------
//  El navegador NUNCA habla con Supabase: habla con este endpoint, y este
//  endpoint habla con Supabase. Así ninguna clave sale al cliente y todas las
//  entradas pasan por la validación de `lib/oportunidades.js`.
//
//  Sesiones: las gestiona Supabase Auth (correo y contraseña de verdad, con
//  recuperación). El navegador guarda el `access_token` y lo manda en cada
//  petición; aquí se reenvía a PostgREST, de modo que las políticas RLS del
//  esquema deciden qué puede ver cada persona. Si alguien se cuela con un
//  token manipulado, Supabase lo rechaza: no dependemos de comprobarlo aquí.
//
//  Variables de entorno (Vercel → Settings → Environment Variables):
//    SUPABASE_URL           https://xxxxx.supabase.co
//    SUPABASE_ANON_KEY      clave "anon" (publicable por diseño)
//    SUPABASE_SERVICE_KEY   clave "service_role" — SECRETA. Solo se usa para
//                           el portal del comprador, que se identifica con un
//                           token opaco y no tiene sesión de Supabase.
// ============================================================================

import {
  normalizarInmueble,
  normalizarCliente,
  mejoresClientes,
  tokenPortal,
  mensajeWhatsapp,
  mensajesWhatsapp,
  mejoresInmuebles,
  mensajeRespuesta,
  ESTILOS_MENSAJE,
  texto,
  normalizarFoto,
  rutaFoto,
  normalizarGaleria,
  MAX_FOTOS,
  ESTADOS,
  OPERACIONES,
  RESPUESTAS_PORTAL,
} from "../lib/oportunidades.js";

const TIEMPO_LIMITE = 12000;

export function nubeConfigurada() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// ---------------------------------------------------------------------------
//  Llamadas a Supabase
// ---------------------------------------------------------------------------
async function llamar(ruta, { metodo = "GET", token, cuerpo, prefer, servicio = false } = {}) {
  const anon = process.env.SUPABASE_ANON_KEY;
  const clave = servicio ? process.env.SUPABASE_SERVICE_KEY || anon : anon;
  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), TIEMPO_LIMITE);
  let resp;
  try {
    resp = await fetch(`${process.env.SUPABASE_URL}${ruta}`, {
      method: metodo,
      signal: ctrl.signal,
      headers: {
        apikey: clave,
        Authorization: `Bearer ${token || clave}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch (e) {
    const err = new Error(
      e?.name === "AbortError"
        ? "La base de datos ha tardado demasiado. Inténtalo otra vez."
        : `No se pudo conectar con la base de datos: ${e?.message || e}`
    );
    err.status = 504;
    throw err;
  } finally {
    clearTimeout(alarma);
  }

  const bruto = await resp.text();
  let datos = null;
  try {
    datos = bruto ? JSON.parse(bruto) : null;
  } catch {
    datos = bruto;
  }
  if (!resp.ok) {
    const err = new Error(datos?.message || datos?.error_description || datos?.msg || `Supabase respondió ${resp.status}`);
    err.status = resp.status;
    err.detalle = datos;
    throw err;
  }
  return datos;
}

const tabla = (nombre, consulta, opciones) => llamar(`/rest/v1/${nombre}${consulta || ""}`, opciones);
const rpcServicio = (fn, args) =>
  llamar(`/rest/v1/rpc/${fn}`, { metodo: "POST", cuerpo: args, servicio: true });

/** El token del usuario viaja en la cabecera Authorization, como es estándar. */
function tokenDe(req) {
  const h = String(req.headers?.authorization || req.headers?.Authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

async function perfilDe(token) {
  if (!token) return null;
  const filas = await tabla("ou_usuarios", "?select=id,nombre,email,rol,activo&limit=1", { token });
  const u = Array.isArray(filas) ? filas[0] : null;
  return u && u.activo ? u : null;
}

// ---------------------------------------------------------------------------
//  Acciones
// ---------------------------------------------------------------------------
const CAMPOS_INMUEBLE =
  "id,referencia,titulo,operacion,precio,ciudad,zona,codigo_postal,provincia,direccion_privada," +
  "habitaciones,banos,metros,caracteristicas,etiquetas,descripcion,estado,agente_id,publico,slug," +
  "portada_url,fotos,video_url,creado,actualizado";

const CAMPOS_CLIENTE =
  "id,nombre,apellidos,telefono,email,tipo,operacion,presupuesto_max,zonas,habitaciones_min," +
  "metros_min,necesita,notas,agente_id,token_portal,inmuebles_autorizados,anonimizado,ultimo_contacto,creado";

async function accionLogin(cuerpo) {
  const email = texto(cuerpo.email, 120).toLowerCase();
  const password = String(cuerpo.password ?? "");
  if (!email || !password) {
    return { estado: 400, cuerpo: { error: "Escribe tu correo y tu contraseña." } };
  }

  let sesion;
  try {
    sesion = await llamar("/auth/v1/token?grant_type=password", {
      metodo: "POST",
      cuerpo: { email, password },
    });
  } catch (e) {
    // Supabase distingue credenciales malas (400) de un problema suyo.
    if (e.status === 400) {
      return { estado: 401, cuerpo: { error: "Correo o contraseña incorrectos." } };
    }
    throw e;
  }

  const perfil = await perfilDe(sesion.access_token);
  if (!perfil) {
    return {
      estado: 403,
      cuerpo: {
        error:
          "Tu usuario existe pero todavía no está dado de alta en el despacho. Pídele a un administrador que te añada.",
      },
    };
  }

  return {
    estado: 200,
    cuerpo: {
      token: sesion.access_token,
      refresco: sesion.refresh_token,
      expira: sesion.expires_at,
      usuario: perfil,
    },
  };
}

// Lo que los clientes han dicho en su portal, con el mensaje de contestación
// ya escrito. Si la consulta falla, el panel sale igual sin esta sección: es
// una ayuda, no algo que deba tumbar la pantalla principal.
async function respuestasRecientes(token, perfil, filtro = "", limite = 12) {
  try {
    const filas = await tabla(
      "ou_respuestas",
      "?select=id,respuesta,creado,cliente:ou_clientes(id,nombre,apellidos,telefono)," +
        "inmueble:ou_inmuebles(id,titulo,slug,precio,operacion)" +
        `${filtro}&order=creado.desc&limit=${limite}`,
      { token }
    );
    return (filas || [])
      .filter((r) => r.cliente && r.inmueble)
      .map((r) => ({
        ...r,
        mensaje: mensajeRespuesta({ respuesta: r.respuesta, cliente: r.cliente, inmueble: r.inmueble, firma: { agente: perfil.nombre } }),
      }));
  } catch (e) {
    console.error("No se pudieron leer las respuestas del portal:", String(e?.message || e));
    return [];
  }
}

async function accionPanel(token, perfil) {
  const [inmuebles, tareas, actividad] = await Promise.all([
    tabla("ou_inmuebles", `?select=${CAMPOS_INMUEBLE}&order=actualizado.desc&limit=6`, { token }),
    tabla("ou_tareas", "?select=id,titulo,estado,vence,cliente_id,inmueble_id&estado=eq.pendiente&order=vence.asc&limit=8", { token }),
    tabla("ou_actividad", "?select=id,tipo,resumen,creado,autor_nombre&order=creado.desc&limit=10", { token }),
  ]);

  const total = await tabla("ou_inmuebles", "?select=id,estado", { token });
  const cuenta = (estado) => total.filter((i) => i.estado === estado).length;
  const respuestas = await respuestasRecientes(token, perfil);

  return {
    estado: 200,
    cuerpo: {
      usuario: perfil,
      metricas: {
        disponibles: cuenta("disponible"),
        borradores: cuenta("borrador"),
        reservados: cuenta("reservado"),
        vendidos: cuenta("vendido"),
        total: total.length,
      },
      inmuebles,
      tareas,
      actividad,
      respuestas,
    },
  };
}

async function accionInmueblesListar(token, cuerpo) {
  const filtros = [];
  const estado = String(cuerpo.estado || "").trim();
  if (ESTADOS.some((e) => e.id === estado)) filtros.push(`estado=eq.${estado}`);
  const operacion = String(cuerpo.operacion || "").trim();
  if (OPERACIONES.includes(operacion)) filtros.push(`operacion=eq.${operacion}`);
  const busca = texto(cuerpo.busca, 60);
  if (busca) {
    // `or` de PostgREST: título, referencia, ciudad o zona.
    const patron = encodeURIComponent(`*${busca}*`);
    filtros.push(`or=(titulo.ilike.${patron},referencia.ilike.${patron},ciudad.ilike.${patron},zona.ilike.${patron})`);
  }
  const consulta = `?select=${CAMPOS_INMUEBLE}&order=actualizado.desc&limit=200${filtros.length ? "&" + filtros.join("&") : ""}`;
  return { estado: 200, cuerpo: { inmuebles: await tabla("ou_inmuebles", consulta, { token }) } };
}

async function accionInmuebleGuardar(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }

  // La referencia automática necesita saber cuántos hay para seguir la serie.
  const existentes = await tabla("ou_inmuebles", "?select=id&limit=1000", { token });
  const { ok, errores, inmueble } = normalizarInmueble(cuerpo.inmueble || {}, {
    secuencia: existentes.length + 1,
  });
  if (!ok) return { estado: 400, cuerpo: { error: errores.join(" "), errores } };

  const id = texto(cuerpo.id, 40);
  let guardado;
  if (id) {
    const filas = await tabla("ou_inmuebles", `?id=eq.${id}&select=${CAMPOS_INMUEBLE}`, {
      metodo: "PATCH",
      token,
      cuerpo: inmueble,
      prefer: "return=representation",
    });
    guardado = filas[0];
    if (!guardado) return { estado: 404, cuerpo: { error: "Ese inmueble ya no existe." } };
  } else {
    const filas = await tabla("ou_inmuebles", `?select=${CAMPOS_INMUEBLE}`, {
      metodo: "POST",
      token,
      cuerpo: { ...inmueble, agente_id: perfil.id },
      prefer: "return=representation",
    });
    guardado = filas[0];
  }

  await apuntar(token, perfil, {
    tipo: id ? "inmueble_editado" : "inmueble_nuevo",
    resumen: `${id ? "Actualizado" : "Nuevo inmueble"}: ${guardado.titulo} (${guardado.referencia})`,
    inmueble_id: guardado.id,
  });

  return { estado: 200, cuerpo: { inmueble: guardado } };
}

async function accionClientesListar(token) {
  return {
    estado: 200,
    cuerpo: {
      clientes: await tabla("ou_clientes", `?select=${CAMPOS_CLIENTE}&anonimizado=is.false&order=creado.desc&limit=300`, { token }),
    },
  };
}

async function accionClienteGuardar(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }
  const { ok, errores, cliente } = normalizarCliente(cuerpo.cliente || {});
  if (!ok) return { estado: 400, cuerpo: { error: errores.join(" "), errores } };

  const id = texto(cuerpo.id, 40);
  let guardado;
  if (id) {
    const filas = await tabla("ou_clientes", `?id=eq.${id}&select=${CAMPOS_CLIENTE}`, {
      metodo: "PATCH",
      token,
      cuerpo: cliente,
      prefer: "return=representation",
    });
    guardado = filas[0];
    if (!guardado) return { estado: 404, cuerpo: { error: "Ese cliente ya no existe." } };
  } else {
    const filas = await tabla("ou_clientes", `?select=${CAMPOS_CLIENTE}`, {
      metodo: "POST",
      token,
      cuerpo: { ...cliente, agente_id: perfil.id, token_portal: tokenPortal() },
      prefer: "return=representation",
    });
    guardado = filas[0];
  }

  await apuntar(token, perfil, {
    tipo: id ? "cliente_editado" : "cliente_nuevo",
    resumen: `${id ? "Actualizado" : "Nuevo cliente"}: ${guardado.nombre}`,
    cliente_id: guardado.id,
  });

  return { estado: 200, cuerpo: { cliente: guardado } };
}

/** Los clientes que mejor encajan con un inmueble — el cálculo está en lib/. */
async function accionCoincidencias(token, cuerpo) {
  const id = texto(cuerpo.id, 40);
  if (!id) return { estado: 400, cuerpo: { error: "Falta el inmueble." } };
  const [inmuebles, clientes] = await Promise.all([
    tabla("ou_inmuebles", `?id=eq.${id}&select=${CAMPOS_INMUEBLE}&limit=1`, { token }),
    tabla("ou_clientes", `?select=${CAMPOS_CLIENTE}&anonimizado=is.false&limit=300`, { token }),
  ]);
  const inmueble = inmuebles[0];
  if (!inmueble) return { estado: 404, cuerpo: { error: "Ese inmueble ya no existe." } };
  return { estado: 200, cuerpo: { inmueble, coincidencias: mejoresClientes(inmueble, clientes) } };
}

/** Prepara el envío al cliente: autoriza inmuebles, da enlace y mensaje. */
async function accionEnviarSeleccion(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }
  const clienteId = texto(cuerpo.cliente_id, 40);
  const ids = (Array.isArray(cuerpo.inmuebles) ? cuerpo.inmuebles : []).map((i) => texto(i, 40)).filter(Boolean).slice(0, 50);
  if (!clienteId || !ids.length) {
    return { estado: 400, cuerpo: { error: "Elige un cliente y al menos un inmueble." } };
  }

  const clientes = await tabla("ou_clientes", `?id=eq.${clienteId}&select=${CAMPOS_CLIENTE}&limit=1`, { token });
  const cliente = clientes[0];
  if (!cliente) return { estado: 404, cuerpo: { error: "Ese cliente ya no existe." } };

  const token_portal = cliente.token_portal || tokenPortal();
  const autorizados = [...new Set([...(cliente.inmuebles_autorizados || []), ...ids])];
  const filas = await tabla("ou_clientes", `?id=eq.${clienteId}&select=${CAMPOS_CLIENTE}`, {
    metodo: "PATCH",
    token,
    cuerpo: { token_portal, inmuebles_autorizados: autorizados, ultimo_contacto: new Date().toISOString() },
    prefer: "return=representation",
  });

  const inmuebles = await tabla(
    "ou_inmuebles",
    `?id=in.(${ids.join(",")})&select=id,titulo,operacion,metros,habitaciones,precio,zona,ciudad,slug,publico,estado,video_url`,
    { token }
  );

  // Un inmueble sin publicar no aparece en el portal del cliente ni tiene
  // ficha que enseñarle. Se manda igual —a veces es lo que quieres— pero se
  // avisa, porque si no el cliente abre el enlace y no ve ese piso.
  const sinPublicar = inmuebles.filter((i) => !i.publico || !i.slug).map((i) => i.titulo);

  const base = texto(cuerpo.base_url, 200) || "";
  const enlacePortal = base ? `${base.replace(/\/+$/, "")}/oportunidades/portal.html#${token_portal}` : "";

  await apuntar(token, perfil, {
    tipo: "seleccion_enviada",
    resumen: `Selección de ${ids.length} inmueble(s) preparada para ${cliente.nombre}`,
    cliente_id: clienteId,
  });

  return {
    estado: 200,
    cuerpo: {
      cliente: filas[0],
      enlace: enlacePortal,
      sin_publicar: sinPublicar,
      mensaje: mensajeWhatsapp({
        cliente,
        inmuebles,
        enlacePortal,
        base,
        firma: { agente: perfil.nombre },
      }),
      // Los tres estilos, para cambiar de tono en la pantalla sin otra llamada.
      mensajes: mensajesWhatsapp({ cliente, inmuebles, enlacePortal, base, firma: { agente: perfil.nombre } }),
      estilos: ESTILOS_MENSAJE,
    },
  };
}

/**
 * Todo lo de un cliente para trabajar con él desde su ficha: qué le he
 * mandado, qué ha contestado y qué más le podría encajar.
 */
async function accionClienteDetalle(token, perfil, cuerpo) {
  const id = texto(cuerpo.id, 40);
  if (!id) return { estado: 400, cuerpo: { error: "Falta el cliente." } };
  const [clientes, inmuebles] = await Promise.all([
    tabla("ou_clientes", `?id=eq.${id}&select=${CAMPOS_CLIENTE}&limit=1`, { token }),
    tabla("ou_inmuebles", `?select=${CAMPOS_INMUEBLE}&order=actualizado.desc&limit=300`, { token }),
  ]);
  const cliente = clientes[0];
  if (!cliente) return { estado: 404, cuerpo: { error: "Ese cliente ya no existe." } };

  const respuestas = await respuestasRecientes(token, perfil, `&cliente_id=eq.${id}`, 50);
  // La última respuesta a cada inmueble es la que vale.
  const ultima = {};
  for (const r of respuestas) if (!ultima[r.inmueble.id]) ultima[r.inmueble.id] = r.respuesta;

  const autorizados = new Set(cliente.inmuebles_autorizados || []);
  const enviados = inmuebles
    .filter((i) => autorizados.has(i.id))
    .map((i) => ({ id: i.id, titulo: i.titulo, precio: i.precio, operacion: i.operacion, estado: i.estado,
      slug: i.slug, publico: i.publico, portada_url: i.portada_url, respuesta: ultima[i.id] || null }));

  return {
    estado: 200,
    cuerpo: {
      cliente,
      enviados,
      respuestas,
      sugeridos: mejoresInmuebles(cliente, inmuebles).map((m) => ({
        inmueble: m.inmueble, puntos: m.puntos, resumen: m.resumen, ya_enviado: m.ya_enviado,
      })),
    },
  };
}

async function apuntar(token, perfil, { tipo, resumen, inmueble_id = null, cliente_id = null }) {
  try {
    await tabla("ou_actividad", "", {
      metodo: "POST",
      token,
      cuerpo: { tipo, resumen, inmueble_id, cliente_id, autor_id: perfil.id, autor_nombre: perfil.nombre },
      prefer: "return=minimal",
    });
  } catch (e) {
    // El historial es importante, pero no tanto como para tumbar la operación
    // que el usuario acaba de hacer. Queda en los registros del servidor.
    console.error("No se pudo apuntar la actividad:", String(e?.message || e));
  }
}

// ---- Fotos -----------------------------------------------------------------
//  El archivo viaja en base64 dentro del JSON y se sube al almacén de Supabase
//  con el token del usuario, así que las políticas del bucket deciden si puede.
const urlPublica = (ruta) => `${process.env.SUPABASE_URL}/storage/v1/object/public/inmuebles/${ruta}`;

async function subirAlAlmacen(ruta, bytes, tipo, token) {
  const ctrl = new AbortController();
  const alarma = setTimeout(() => ctrl.abort(), 20000);
  let resp;
  try {
    resp = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/inmuebles/${ruta}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": tipo,
        "x-upsert": "false",
      },
      body: bytes,
    });
  } catch (e) {
    const err = new Error(
      e?.name === "AbortError"
        ? "La foto no se pudo subir: la conexión tardó demasiado."
        : `La foto no se pudo subir: ${e?.message || e}`
    );
    err.status = 504;
    throw err;
  } finally {
    clearTimeout(alarma);
  }
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => "");
    const err = new Error(
      resp.status === 403
        ? "Tu usuario no puede subir fotos."
        : `El almacén rechazó la foto (${resp.status}).`
    );
    err.status = resp.status;
    err.detalle = detalle;
    throw err;
  }
}

async function borrarDelAlmacen(ruta, token) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/inmuebles/${ruta}`, {
      method: "DELETE",
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    // Si el archivo se queda huérfano en el almacén no es grave; lo que importa
    // es que desaparezca de la ficha, y eso sí se comprueba.
    console.error("No se pudo borrar la foto del almacén:", String(e?.message || e));
  }
}

async function inmuebleDe(token, id) {
  const filas = await tabla("ou_inmuebles", `?id=eq.${id}&select=${CAMPOS_INMUEBLE}&limit=1`, { token });
  return filas[0] || null;
}

async function accionFotoSubir(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }
  const id = texto(cuerpo.id, 40);
  if (!id) return { estado: 400, cuerpo: { error: "Guarda el inmueble antes de añadirle fotos." } };

  const inmueble = await inmuebleDe(token, id);
  if (!inmueble) return { estado: 404, cuerpo: { error: "Ese inmueble ya no existe." } };

  const galeria = normalizarGaleria(inmueble.fotos);
  if (galeria.length >= MAX_FOTOS) {
    return { estado: 400, cuerpo: { error: `Este inmueble ya tiene ${MAX_FOTOS} fotos, que son de sobra.` } };
  }

  const { ok, errores, foto } = normalizarFoto(cuerpo);
  if (!ok) return { estado: 400, cuerpo: { error: errores.join(" "), errores } };

  const ruta = rutaFoto(id, foto.extension);
  await subirAlAlmacen(ruta, foto.bytes, foto.tipo, token);

  const url = urlPublica(ruta);
  const fotos = [...galeria, { url, ruta }];
  // La primera foto que entra se queda de portada: es lo que se espera.
  const cambios = { fotos };
  if (!inmueble.portada_url) cambios.portada_url = url;

  const filas = await tabla("ou_inmuebles", `?id=eq.${id}&select=${CAMPOS_INMUEBLE}`, {
    metodo: "PATCH", token, cuerpo: cambios, prefer: "return=representation",
  });
  return { estado: 200, cuerpo: { inmueble: filas[0] } };
}

async function accionFotoBorrar(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }
  const id = texto(cuerpo.id, 40);
  const ruta = texto(cuerpo.ruta, 200);
  const inmueble = id ? await inmuebleDe(token, id) : null;
  if (!inmueble) return { estado: 404, cuerpo: { error: "Ese inmueble ya no existe." } };

  const galeria = normalizarGaleria(inmueble.fotos);
  const quitada = galeria.find((f) => f.ruta === ruta);
  if (!quitada) return { estado: 404, cuerpo: { error: "Esa foto ya no está en la ficha." } };

  const fotos = galeria.filter((f) => f.ruta !== ruta);
  const cambios = { fotos };
  // Si se borra la portada, pasa a serlo la siguiente (o ninguna).
  if (inmueble.portada_url === quitada.url) cambios.portada_url = fotos[0]?.url || null;

  const filas = await tabla("ou_inmuebles", `?id=eq.${id}&select=${CAMPOS_INMUEBLE}`, {
    metodo: "PATCH", token, cuerpo: cambios, prefer: "return=representation",
  });
  await borrarDelAlmacen(ruta, token);
  return { estado: 200, cuerpo: { inmueble: filas[0] } };
}

async function accionFotoPortada(token, perfil, cuerpo) {
  if (perfil.rol === "lector") {
    return { estado: 403, cuerpo: { error: "Tu usuario es de solo lectura." } };
  }
  const id = texto(cuerpo.id, 40);
  const url = texto(cuerpo.url, 500);
  const inmueble = id ? await inmuebleDe(token, id) : null;
  if (!inmueble) return { estado: 404, cuerpo: { error: "Ese inmueble ya no existe." } };
  if (!normalizarGaleria(inmueble.fotos).some((f) => f.url === url)) {
    return { estado: 400, cuerpo: { error: "Esa foto no es de este inmueble." } };
  }
  const filas = await tabla("ou_inmuebles", `?id=eq.${id}&select=${CAMPOS_INMUEBLE}`, {
    metodo: "PATCH", token, cuerpo: { portada_url: url }, prefer: "return=representation",
  });
  return { estado: 200, cuerpo: { inmueble: filas[0] } };
}

// ---- Comprobación de la instalación ----------------------------------------
//  Para que montar esto no sea adivinar: dice qué falta y cómo arreglarlo.
//  No devuelve ninguna clave ni ningún dato de la base; solo si cada pieza
//  responde. Es la pantalla que se mira cuando algo no entra.
async function accionEstado() {
  const pasos = [];
  const apunta = (nombre, ok, detalle, arreglo = null) => pasos.push({ nombre, ok, detalle, arreglo });

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const servicio = process.env.SUPABASE_SERVICE_KEY;

  apunta("Dirección del proyecto (SUPABASE_URL)", Boolean(url),
    url ? "configurada" : "falta",
    "Vercel → Settings → Environment Variables → SUPABASE_URL (Supabase → Settings → API → Project URL).");
  apunta("Clave pública (SUPABASE_ANON_KEY)", Boolean(anon),
    anon ? "configurada" : "falta",
    "Vercel → Settings → Environment Variables → SUPABASE_ANON_KEY (la clave `anon public`).");
  apunta("Clave de servicio (SUPABASE_SERVICE_KEY)", Boolean(servicio),
    servicio ? "configurada" : "falta — sin ella el portal del comprador no abrirá",
    "Vercel → Settings → Environment Variables → SUPABASE_SERVICE_KEY (la clave `service_role`, secreta).");

  if (!url || !anon) {
    return { estado: 200, cuerpo: { listo: false, pasos } };
  }

  // Las tablas: si el esquema no se ha ejecutado, PostgREST responde 404.
  for (const [tablaNombre, etiqueta] of [
    ["ou_usuarios", "Tabla de usuarios"],
    ["ou_inmuebles", "Tabla de inmuebles"],
    ["ou_clientes", "Tabla de clientes"],
    ["ou_publico", "Vista de fichas públicas"],
  ]) {
    try {
      await tabla(tablaNombre, "?select=*&limit=0");
      apunta(etiqueta, true, "creada");
    } catch (e) {
      apunta(etiqueta, false,
        e.status === 404 ? "no existe todavía" : `no responde (${e.status || "?"})`,
        "Supabase → SQL Editor → pega `oportunidades/esquema.sql` entero y pulsa Run.");
    }
  }

  // El almacén de fotos (hace falta la clave de servicio para preguntarlo).
  if (servicio) {
    try {
      await llamar("/storage/v1/bucket/inmuebles", { servicio: true });
      apunta("Almacén de fotos", true, "listo");
    } catch (e) {
      apunta("Almacén de fotos", false,
        e.status === 404 ? "el bucket `inmuebles` no existe" : `no responde (${e.status || "?"})`,
        "Lo crea el propio esquema. Vuelve a ejecutar `oportunidades/esquema.sql` entero.");
    }

    // ¿Hay alguien dado de alta? Sin eso se puede entrar pero no se ve nada.
    try {
      const usuarios = await llamar("/rest/v1/ou_usuarios?select=id&limit=1", { servicio: true });
      const hay = Array.isArray(usuarios) && usuarios.length > 0;
      apunta("Usuario del despacho", hay,
        hay ? "hay al menos uno dado de alta" : "no hay ninguno: podrás iniciar sesión pero no verás nada",
        "Crea el usuario en Authentication → Users y ejecuta el `insert` del final de `esquema.sql` con tu correo.");
    } catch {
      apunta("Usuario del despacho", false, "no se pudo comprobar",
        "Revisa que el esquema esté ejecutado y que la clave de servicio sea la correcta.");
    }
  }

  return { estado: 200, cuerpo: { listo: pasos.every((p) => p.ok), pasos } };
}

// ---- Sin sesión: ficha pública y portal del comprador ----------------------
async function accionFichaPublica(cuerpo) {
  const slug = texto(cuerpo.slug, 100);
  if (!slug) return { estado: 400, cuerpo: { error: "Falta la ficha." } };
  const filas = await tabla("ou_publico", `?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (!filas.length) return { estado: 404, cuerpo: { error: "Esta ficha ya no está disponible." } };
  return { estado: 200, cuerpo: { inmueble: filas[0] } };
}

async function accionPortalLeer(cuerpo) {
  const token = texto(cuerpo.token, 64);
  const datos = await rpcServicio("ou_portal", { token_dado: token });
  if (!datos) return { estado: 404, cuerpo: { error: "Este enlace ya no es válido. Pídenos uno nuevo." } };
  return { estado: 200, cuerpo: datos };
}

async function accionPortalResponder(cuerpo) {
  const token = texto(cuerpo.token, 64);
  const slug = texto(cuerpo.slug, 100);
  const respuesta = texto(cuerpo.respuesta, 20);
  if (!RESPUESTAS_PORTAL.includes(respuesta)) {
    return { estado: 400, cuerpo: { error: "Respuesta no válida." } };
  }
  const salida = await rpcServicio("ou_portal_responde", {
    token_dado: token,
    slug_dado: slug,
    respuesta_dada: respuesta,
  });
  if (!salida?.ok) return { estado: 400, cuerpo: { error: salida?.error || "No se pudo registrar tu respuesta." } };
  return { estado: 200, cuerpo: { ok: true } };
}

// Acciones que no necesitan sesión del despacho.
const PUBLICAS = {
  login: (_t, _p, cuerpo) => accionLogin(cuerpo),
  estado: () => accionEstado(),
  ficha: (_t, _p, cuerpo) => accionFichaPublica(cuerpo),
  "portal.leer": (_t, _p, cuerpo) => accionPortalLeer(cuerpo),
  "portal.responder": (_t, _p, cuerpo) => accionPortalResponder(cuerpo),
};

const PRIVADAS = {
  perfil: (_t, perfil) => ({ estado: 200, cuerpo: { usuario: perfil } }),
  panel: (token, perfil) => accionPanel(token, perfil),
  "inmuebles.listar": (token, _p, cuerpo) => accionInmueblesListar(token, cuerpo),
  "inmuebles.guardar": (token, perfil, cuerpo) => accionInmuebleGuardar(token, perfil, cuerpo),
  "clientes.listar": (token) => accionClientesListar(token),
  "clientes.guardar": (token, perfil, cuerpo) => accionClienteGuardar(token, perfil, cuerpo),
  coincidencias: (token, _p, cuerpo) => accionCoincidencias(token, cuerpo),
  "fotos.subir": (token, perfil, cuerpo) => accionFotoSubir(token, perfil, cuerpo),
  "fotos.borrar": (token, perfil, cuerpo) => accionFotoBorrar(token, perfil, cuerpo),
  "fotos.portada": (token, perfil, cuerpo) => accionFotoPortada(token, perfil, cuerpo),
  "seleccion.enviar": (token, perfil, cuerpo) => accionEnviarSeleccion(token, perfil, cuerpo),
  "cliente.detalle": (token, perfil, cuerpo) => accionClienteDetalle(token, perfil, cuerpo),
};

// ---------------------------------------------------------------------------
//  Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Usa POST con un cuerpo JSON." });
  }
  if (!nubeConfigurada() && String(req.body?.accion || "") === "estado") {
    const r = await accionEstado();
    return res.status(r.estado).json(r.cuerpo);
  }
  if (!nubeConfigurada()) {
    return res.status(503).json({
      error:
        "La base de datos no está configurada. Añade SUPABASE_URL y SUPABASE_ANON_KEY en Vercel → Settings → Environment Variables y vuelve a desplegar.",
    });
  }

  const cuerpo = req.body ?? {};
  const accion = String(cuerpo.accion || "").trim();
  res.setHeader("Cache-Control", "no-store");

  try {
    if (PUBLICAS[accion]) {
      const r = await PUBLICAS[accion](null, null, cuerpo);
      return res.status(r.estado).json(r.cuerpo);
    }

    if (!PRIVADAS[accion]) {
      return res.status(400).json({ error: "Acción no reconocida." });
    }

    const token = tokenDe(req);
    if (!token) return res.status(401).json({ error: "Inicia sesión para continuar." });

    let perfil;
    try {
      perfil = await perfilDe(token);
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        return res.status(401).json({ error: "Tu sesión ha caducado. Vuelve a entrar." });
      }
      throw e;
    }
    if (!perfil) {
      return res.status(403).json({ error: "Tu usuario no tiene acceso al despacho." });
    }

    const r = await PRIVADAS[accion](token, perfil, cuerpo);
    return res.status(r.estado).json(r.cuerpo);
  } catch (e) {
    const estado = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    if (estado >= 500) console.error(`Error en /api/oportunidades (${accion}):`, e);
    return res.status(estado).json({ error: e.message || "Error interno." });
  }
}
